import { AxiosError } from 'axios'
import type { AxiosAdapter, InternalAxiosRequestConfig } from 'axios'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { useAuthStore } from '@/shared/store/authStore'

import {
  ApiError,
  apiErrorMessage,
  http,
  isApiError,
  isUnreachable,
} from './http'

const originalAdapter = http.defaults.adapter

/**
 * 나가는 요청을 가로채 헤더만 들여다봅니다. 인터셉터 배열을 직접 들추지 않는 것은
 * axios 내부 모양이라 판이 바뀌면 테스트만 조용히 통과해서입니다.
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

/**
 * 경로마다 다른 답을 주는 어댑터. `status: 0` 은 **응답 자체가 없는** 네트워크
 * 실패라 `response` 를 달지 않습니다 — 인터셉터가 `?? 0` 으로 읽는 그 경우입니다.
 */
function respondWith(
  answer: (url: string, attempt: number) => { status: number; data?: unknown },
) {
  const attempts = new Map<string, number>()

  const adapter: AxiosAdapter = (config) => {
    const url = config.url ?? ''
    const attempt = (attempts.get(url) ?? 0) + 1
    attempts.set(url, attempt)

    const { status, data = {} } = answer(url, attempt)
    const response = { data, status, statusText: '', headers: {}, config }

    if (status >= 200 && status < 300) return Promise.resolve(response)

    if (status === 0) {
      return Promise.reject(
        new AxiosError('Network Error', AxiosError.ERR_NETWORK, config),
      )
    }

    return Promise.reject(
      new AxiosError('failed', String(status), config, null, response),
    )
  }

  http.defaults.adapter = adapter
}

describe('토큰이 만료됐을 때의 재발급', () => {
  it('재발급에 성공하면 새 토큰으로 다시 보낸다', async () => {
    respondWith((url, attempt) => {
      if (url.startsWith('/auth/refresh')) {
        return { status: 200, data: { accessToken: 'fresh.access.token' } }
      }
      // 첫 번째는 만료로 401, 재발급 뒤의 두 번째는 통과합니다
      return attempt === 1
        ? { status: 401 }
        : { status: 200, data: { ok: true } }
    })

    const { data } = await http.get('/users/me')

    expect(data).toEqual({ ok: true })
    expect(useAuthStore.getState().accessToken).toBe('fresh.access.token')
  })

  it('서버가 리프레시 토큰을 거절하면(401) 로그아웃한다', async () => {
    respondWith((url) =>
      url.startsWith('/auth/refresh') ? { status: 401 } : { status: 401 },
    )

    await expect(http.get('/users/me')).rejects.toThrow()

    expect(useAuthStore.getState().accessToken).toBeNull()
  })

  /*
   * 이 셋이 전에는 전부 로그아웃이었습니다. 백엔드를 재시작하는 몇 초, 배포 중 순단,
   * 끊긴 와이파이 — 토큰은 멀쩡한데 세션만 날아갔습니다.
   */
  it.each([
    ['서버에 닿지 못하면', 0],
    ['게이트웨이가 백엔드에 못 닿으면', 502],
    ['서버가 오류를 내면', 500],
  ])('재발급이 %s 로그인을 유지한다', async (_label, refreshStatus) => {
    respondWith((url) =>
      url.startsWith('/auth/refresh')
        ? { status: refreshStatus }
        : { status: 401 },
    )

    await expect(http.get('/users/me')).rejects.toSatisfy(
      (error: unknown) => isApiError(error) && error.status === refreshStatus,
    )

    expect(useAuthStore.getState().accessToken).toBe('expired.access.token')
  })
})

describe('isUnreachable', () => {
  it.each([0, 502, 503, 504])(
    'status %i 은 백엔드에 닿지 못한 것이다',
    (status) => {
      expect(isUnreachable(status)).toBe(true)
    },
  )

  it.each([400, 401, 404, 500, 501, 505])(
    'status %i 은 백엔드가 대답한 것이다',
    (status) => {
      expect(isUnreachable(status)).toBe(false)
    },
  )
})

describe('apiErrorMessage', () => {
  it('서버가 답한 오류면 서버 문구를 쓴다', () => {
    const error = new ApiError(409, 'DUPLICATE', '이미 같은 이름이 있습니다')

    expect(apiErrorMessage(error, '만들지 못했습니다')).toBe(
      '이미 같은 이름이 있습니다',
    )
  })

  it('그 밖의 예외면 대신할 문구를 쓴다', () => {
    expect(
      apiErrorMessage(new TypeError('엉뚱한 오류'), '만들지 못했습니다'),
    ).toBe('만들지 못했습니다')
    expect(apiErrorMessage(null, '만들지 못했습니다')).toBe('만들지 못했습니다')
  })
})
