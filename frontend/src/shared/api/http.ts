import axios, {
  AxiosError,
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from 'axios'

import { env } from '@/shared/config/env'
import { useAuthStore } from '@/shared/store/authStore'

/** 서버가 내려주는 공통 에러 응답 형태. 백엔드와 스펙 확정 후 맞춰서 수정하세요. */
export interface ApiErrorResponse {
  code: string
  message: string
}

/** 앱 전체에서 다루는 에러 타입 (axios 에 의존하지 않도록 한 번 감쌉니다) */
export class ApiError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError
}

/**
 * 세션이 끊겼을 때 이어서 할 정리 작업.
 *
 * 스토어를 비우는 것만으로는 부족합니다 — 쿼리 캐시에 앞 사람의 응답이 남으면
 * 같은 브라우저에서 다음에 로그인한 사람이 그 화면을 잠깐 봅니다.
 *
 * 그렇다고 여기서 `queryClient` 를 import 하면 `queryClient` 가 `isApiError` 때문에
 * 다시 이 파일을 import 해 순환이 됩니다. 그래서 **캐시 쪽이 자기를 등록하는**
 * 방향으로 두어 의존을 한쪽으로만 흐르게 합니다.
 */
let onSessionExpired: (() => void) | null = null

export function setSessionExpiredHandler(handler: () => void): void {
  onSessionExpired = handler
}

/** 이 브라우저의 로그인 흔적을 지웁니다 */
function endSession(): void {
  useAuthStore.getState().clear()
  onSessionExpired?.()
}

export const http: AxiosInstance = axios.create({
  baseURL: env.apiBaseUrl,
  timeout: 10_000,
  withCredentials: true, // refresh token 을 httpOnly 쿠키로 받는 경우 필요
  headers: { 'Content-Type': 'application/json' },
})

// 요청 인터셉터: 액세스 토큰 주입
http.interceptors.request.use((config) => {
  const { accessToken } = useAuthStore.getState()

  if (accessToken) {
    config.headers.setAuthorization(`Bearer ${accessToken}`)
  }

  return config
})

/**
 * 재발급을 시도하지 않는 경로.
 *
 * 로그인 실패(`AUTH_INVALID_CREDENTIALS`)도 401 입니다. 여기서 빼지 않으면
 * 비밀번호를 틀릴 때마다 재발급을 부르고, 그 재발급이 또 401 이 되어
 * 요청이 두 배로 나갑니다. **만료된 토큰과 틀린 자격 증명은 같은 상태
 * 코드지만 다른 일입니다.**
 */
const NO_REFRESH_PATHS = [
  '/auth/login',
  '/auth/signup',
  '/auth/refresh',
  '/auth/logout',
]

/** 한 번 재발급하고 다시 보낸 요청인지. 같은 요청을 무한히 재시도하지 않게 합니다 */
type RetriedConfig = InternalAxiosRequestConfig & { _retried?: boolean }

/**
 * 진행 중인 재발급 하나를 모두가 같이 기다립니다.
 *
 * 한 화면이 쿼리를 여러 쓰면 토큰이 만료되는 순간 전부 401 이 됩니다.
 * 각자 재발급하면 `/auth/refresh` 가 동시에 여러 번 나가고, 서버가
 * 회전시키는 refresh 토큰과 어긋나 멀쩅한 세션이 끊깁니다.
 */
let refreshing: Promise<string> | null = null

function refreshAccessToken(): Promise<string> {
  const pending =
    refreshing ??
    http
      .post<{ accessToken: string }>('/auth/refresh')
      .then((response) => response.data.accessToken)
      .finally(() => {
        refreshing = null
      })

  refreshing = pending
  return pending
}

// 응답 인터셉터: 만료된 토큰은 재발급하고, 나머지 에러는 ApiError 로 정규화
http.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (error instanceof AxiosError) {
      const status = error.response?.status ?? 0
      const data = error.response?.data as ApiErrorResponse | undefined
      const config = error.config as RetriedConfig | undefined

      if (status === 401) {
        const { accessToken } = useAuthStore.getState()
        const refreshable =
          config !== undefined &&
          config._retried !== true &&
          // 토큰이 없으면 만료가 아니라 애초에 로그인하지 않은 것입니다
          accessToken !== null &&
          !NO_REFRESH_PATHS.some((path) => config.url?.startsWith(path))

        if (refreshable) {
          config._retried = true

          const renewed = await refreshAccessToken().catch(() => null)

          if (renewed !== null) {
            useAuthStore.getState().setAccessToken(renewed)
            // 요청 인터셉터가 새 토큰으로 Authorization 을 다시 붙입니다
            return http(config)
          }
        }

        /*
         * 끝낼 세션이 있을 때만 정리합니다. 로그인 실패도 401 이라, 여기서 걸러내지
         * 않으면 **로그인한 적 없는 방문자**가 비밀번호를 틀릴 때마다 보고 있던
         * 향수 목록 캐시까지 같이 날아갑니다.
         */
        if (accessToken !== null) {
          endSession()
        }
      }

      return Promise.reject(
        new ApiError(
          status,
          data?.code ?? 'UNKNOWN',
          data?.message ?? error.message,
        ),
      )
    }

    return Promise.reject(
      error instanceof Error ? error : new Error(String(error)),
    )
  },
)
