import { afterEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from './http'
import { withDevFallback } from './withDevFallback'

/*
  `env.isDev` 는 빌드 시점 값이라 테스트에서 바꿀 수 없습니다. 모듈째 흉내 내고
  기본은 개발(true)로 둡니다 — 운영을 볼 때만 아래에서 뒤집습니다.
*/
vi.mock('@/shared/config/env', () => ({
  env: { isDev: true, isProd: false, apiBaseUrl: '/api/v1' },
}))

const apiError = (status: number) =>
  new ApiError(status, 'UNREACHABLE', '닿지 못함')

afterEach(() => {
  vi.restoreAllMocks()
})

describe('withDevFallback', () => {
  it('요청이 성공하면 대체값을 쓰지 않는다', async () => {
    const fallback = vi.fn(() => '대체')

    const result = await withDevFallback(
      'perfume',
      async () => '진짜',
      fallback,
    )

    expect(result).toBe('진짜')
    expect(fallback).not.toHaveBeenCalled()
  })

  /*
    status 0 은 요청이 아예 못 나간 경우이고 502~504 는 앞단(프록시)이 대신 답한
    경우입니다. 둘 다 "백엔드가 대답한 것이 아님" 이라 같이 묶습니다.
  */
  it.each([0, 502, 503, 504])(
    'status %i 이면 백엔드에 닿지 못한 것으로 보고 대체값을 쓴다',
    async (status) => {
      vi.spyOn(console, 'warn').mockImplementation(() => {})

      const result = await withDevFallback(
        'perfume',
        async () => {
          throw apiError(status)
        },
        () => '대체',
      )

      expect(result).toBe('대체')
    },
  )

  /*
    이 갈래가 이 함수의 핵심입니다. 백엔드가 대답한 오류까지 삼키면 진짜 버그가
    자리표시자에 가려집니다.
  */
  it.each([400, 401, 404, 409, 500])(
    'status %i 처럼 백엔드가 대답한 오류는 그대로 올려보낸다',
    async (status) => {
      const fallback = vi.fn(() => '대체')

      await expect(
        withDevFallback(
          'perfume',
          async () => {
            throw apiError(status)
          },
          fallback,
        ),
      ).rejects.toBeInstanceOf(ApiError)
      expect(fallback).not.toHaveBeenCalled()
    },
  )

  it('API 오류가 아닌 것도 그대로 올려보낸다', async () => {
    const fallback = vi.fn(() => '대체')

    await expect(
      withDevFallback(
        'perfume',
        async () => {
          throw new TypeError('엉뚱한 오류')
        },
        fallback,
      ),
    ).rejects.toBeInstanceOf(TypeError)
    expect(fallback).not.toHaveBeenCalled()
  })

  it('어느 도메인이 대체값으로 넘어갔는지 경고에 적는다', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    await withDevFallback(
      'recommend',
      async () => {
        throw apiError(0)
      },
      () => '대체',
    )

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('[recommend]'))
  })
})
