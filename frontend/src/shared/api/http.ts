import axios, {
  AxiosError,
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from 'axios'

import { env } from '@/shared/config/env'
import { useAuthStore } from '@/shared/store/authStore'

interface ApiErrorResponse {
  code: string
  message: string
}

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

export function apiErrorMessage(error: unknown, fallback: string): string {
  return isApiError(error) ? error.message : fallback
}

/**
 * 세션이 끊겼을 때 이어서 할 정리.
 * 캐시에 앞 사람 응답이 남으면 다음 사람이 그 화면을 잠깐 봅니다.
 * NOTE: 여기서 `queryClient` 를 import 하면 순환이 되어, **캐시 쪽이 자기를 등록하는** 방향입니다.
 */
let onSessionExpired: (() => void) | null = null

export function setSessionExpiredHandler(handler: () => void): void {
  onSessionExpired = handler
}

function endSession(): void {
  useAuthStore.getState().clear()
  onSessionExpired?.()
}

export const http: AxiosInstance = axios.create({
  baseURL: env.apiBaseUrl,
  timeout: 10_000,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
})

const NO_AUTH_HEADER_PATHS = ['/auth/login', '/auth/signup', '/auth/refresh']

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

const NO_REFRESH_PATHS = [
  '/auth/login',
  '/auth/signup',
  '/auth/refresh',
  '/auth/logout',
]

export function isUnreachable(status: number): boolean {
  return status === 0 || status === 502 || status === 503 || status === 504
}

const unreachableCode = (status: number) =>
  isUnreachable(status) ? 'SERVER_UNREACHABLE' : undefined

const unreachableMessage = (status: number) =>
  isUnreachable(status)
    ? '서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.'
    : undefined

type RetriedConfig = InternalAxiosRequestConfig & { _retried?: boolean }

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

function isSessionRejected(error: unknown): boolean {
  return isApiError(error) && (error.status === 401 || error.status === 403)
}

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
          accessToken !== null &&
          !NO_REFRESH_PATHS.some((path) => config.url?.startsWith(path))

        if (refreshable) {
          config._retried = true

          try {
            const renewed = await refreshAccessToken()
            useAuthStore.getState().setAccessToken(renewed)
            return http(config)
          } catch (refreshError) {
            if (!isSessionRejected(refreshError)) {
              return Promise.reject(refreshError)
            }
          }
        }

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
