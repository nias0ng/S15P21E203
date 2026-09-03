import axios, { AxiosError, type AxiosInstance } from 'axios'

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

// 응답 인터셉터: 에러를 ApiError 로 정규화
http.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (error instanceof AxiosError) {
      const status = error.response?.status ?? 0
      const data = error.response?.data as ApiErrorResponse | undefined

      // 401 이면 로그아웃 처리 (토큰 재발급 로직은 인증 스펙 확정 후 여기에 추가)
      if (status === 401) {
        useAuthStore.getState().clear()
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
