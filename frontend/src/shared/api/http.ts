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

/**
 * **Authorization 을 붙이면 안 되는 경로.**
 *
 * 백엔드에서 이 셋은 `permitAll` 이지만, `oauth2ResourceServer.jwt()` 가 깔아 둔
 * `BearerTokenAuthenticationFilter` 는 **인가 단계보다 먼저** 돕니다. Authorization
 * 헤더가 있으면 무조건 검증하고, 만료된 토큰이면 그 자리에서 401 을 던집니다.
 * `permitAll` 은 거기까지 오지도 못합니다.
 *
 * 그래서 만료된 토큰을 그대로 달고 `/auth/refresh` 를 부르면 **재발급이 반드시
 * 실패합니다** — 재발급이 필요한 순간은 정의상 토큰이 만료된 순간이라, 이 헤더
 * 하나 때문에 재발급이 한 번도 성공하지 못하고 30분(`access-token-ttl`)마다
 * 자동 로그아웃됐습니다.
 *
 *   Authorization 없음  →  401 AUTH_INVALID_REFRESH_TOKEN  (컨트롤러까지 도달)
 *   Authorization 있음  →  401 AUTH_LOGIN_REQUIRED         (보안 필터가 먼저 차단)
 *
 * **`/auth/logout` 은 여기 넣지 않습니다.** 백엔드가 `authenticated()` 로 잡아 두어
 * 토큰이 있어야 세션을 지울 수 있습니다. 아래 `NO_REFRESH_PATHS` 와 목록이 겹쳐
 * 보이지만 **다른 질문에 답하는 목록입니다** — 여기는 "토큰을 붙일 것인가",
 * 저기는 "401 을 재발급으로 볼 것인가" 입니다.
 */
const NO_AUTH_HEADER_PATHS = ['/auth/login', '/auth/signup', '/auth/refresh']

// 요청 인터셉터: 액세스 토큰 주입
http.interceptors.request.use((config) => {
  const { accessToken } = useAuthStore.getState()
  const isAuthPath = NO_AUTH_HEADER_PATHS.some((path) =>
    config.url?.startsWith(path),
  )

  if (accessToken && !isAuthPath) {
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

/**
 * 서버에 **닿지도 못한** 상태들.
 *
 *   0        요청 자체가 나가지 못했습니다 (네트워크 끊김 · CORS · 타임아웃)
 *   502~504  중간의 프록시 · 게이트웨이가 백엔드에 못 닿았습니다
 *
 * 이때는 백엔드가 우리 형식(`{ code, message }`)으로 답한 것이 아니라서 axios 의
 * 원문("Request failed with status code 502")이 그대로 화면에 나갑니다. 사용자에게
 * 아무 뜻이 없고, 개발 중에도 원인이 안 읽힙니다 — 로컬에서는 대개 백엔드가 꺼진
 * 것입니다. 그래서 여기서만 우리 문구로 바꿔 답니다.
 *
 * 400 · 404 처럼 **백엔드가 대답한 오류는 건드리지 않습니다.** 그 문구가 사정을
 * 훨씬 정확히 설명합니다.
 */
function isUnreachable(status: number): boolean {
  return status === 0 || status === 502 || status === 503 || status === 504
}

const unreachableCode = (status: number) =>
  isUnreachable(status) ? 'SERVER_UNREACHABLE' : undefined

const unreachableMessage = (status: number) =>
  isUnreachable(status)
    ? '서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.'
    : undefined

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
          data?.code ?? unreachableCode(status) ?? 'UNKNOWN',
          data?.message ?? unreachableMessage(status) ?? error.message,
        ),
      )
    }

    return Promise.reject(
      error instanceof Error ? error : new Error(String(error)),
    )
  },
)
