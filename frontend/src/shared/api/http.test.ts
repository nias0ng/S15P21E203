import type { AxiosAdapter, InternalAxiosRequestConfig } from 'axios'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { useAuthStore } from '@/shared/store/authStore'

import { http } from './http'

const originalAdapter = http.defaults.adapter

/**
 * 나가는 요청을 가로채 헤더만 들여다봅니다 — 네트워크를 타지 않습니다.
 *
 * 인터셉터 배열(`http.interceptors.request.handlers`)을 직접 들추지 않는 이유는
 * axios 내부 모양이라 판이 바뀌면 테스트만 조용히 통과하기 때문입니다. 어댑터는
 * 공개 API 이고, **실제로 요청이 나갈 때의 헤더**를 봅니다.
 */
function captureRequests(): InternalAxiosRequestConfig[] {
  const seen: InternalAxiosRequestConfig[] = []

  const adapter: AxiosAdapter = (config) => {
    seen.push(config)
    return Promise.resolve({
      data: {},
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    })
  }

  http.defaults.adapter = adapter
  return seen
}

beforeEach(() => {
  useAuthStore.setState({ accessToken: 'expired.access.token', user: null })
})

afterEach(() => {
  http.defaults.adapter = originalAdapter
  useAuthStore.setState({ accessToken: null, user: null })
})

describe('요청 인터셉터의 Authorization', () => {
  it('보통 요청에는 액세스 토큰을 붙인다', async () => {
    const seen = captureRequests()

    await http.get('/users/me')

    expect(seen[0]?.headers.getAuthorization()).toBe(
      'Bearer expired.access.token',
    )
  })

  /*
   * 재발급이 필요한 순간은 정의상 토큰이 만료된 순간입니다. 그 토큰을 달고 가면
   * 백엔드의 BearerTokenAuthenticationFilter 가 permitAll 보다 먼저 401 을 내서
   * 재발급이 반드시 실패하고, 세션이 30분마다 끊깁니다.
   */
  it('재발급에는 붙이지 않는다', async () => {
    const seen = captureRequests()

    await http.post('/auth/refresh')

    expect(seen[0]?.headers.getAuthorization()).toBeFalsy()
  })

  it('로그인 · 회원가입에도 붙이지 않는다', async () => {
    const seen = captureRequests()

    await http.post('/auth/login', { email: 'a@b.c', password: 'x' })
    await http.post('/auth/signup', { email: 'a@b.c', password: 'x' })

    expect(seen[0]?.headers.getAuthorization()).toBeFalsy()
    expect(seen[1]?.headers.getAuthorization()).toBeFalsy()
  })

  /** 로그아웃은 백엔드가 authenticated() 로 잡아 두어 토큰이 있어야 세션이 지워집니다 */
  it('로그아웃에는 붙인다', async () => {
    const seen = captureRequests()

    await http.post('/auth/logout')

    expect(seen[0]?.headers.getAuthorization()).toBe(
      'Bearer expired.access.token',
    )
  })
})
