import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/shared/api/http'

import { getPersonalRecommendation } from './api'

const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }))

vi.mock('@/shared/api/http', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, http }
})

/*
 * 중괄호로 감쌉니다 — `mockReset()` 은 목 함수 자신을 돌려주는데, beforeEach 가 함수를 돌려받으면
 * 그것을 정리 함수로 여겨 테스트가 끝날 때마다 불러 버립니다(거절하도록 해 둔 목이면 테스트가 실패).
 */
beforeEach(() => {
  http.get.mockReset()
})

/*
 * 서버가 "추천할 수 없다" 고 답하는 네 경우(PersonalizedRecommendationErrorCode). 화면은 앞의 셋을 오류가
 * 아니라 **결과**로 받고, 409 만 오류로 던져 쿼리가 다시 묻게 둡니다.
 */
describe('getPersonalRecommendation', () => {
  it('응답을 편지 한 통으로 펴서 돌려준다 — 손잡이를 향수 곁에 둔다', async () => {
    http.get.mockResolvedValue({
      data: {
        recommendationToken: 'd68e5950-fb99-48dd-9135-2b06ada05e42',
        recommendation: {
          perfumeId: 102,
          name: '아티산 블랙',
          imageUrl: null,
          reason: '취향 테스트에서 선택한 시트러스 계열과 잘 맞아요.',
        },
      },
    })

    await expect(getPersonalRecommendation()).resolves.toEqual({
      status: 'ready',
      recommendation: {
        recommendationToken: 'd68e5950-fb99-48dd-9135-2b06ada05e42',
        perfumeId: 102,
        name: '아티산 블랙',
        imageUrl: null,
        reason: '취향 테스트에서 선택한 시트러스 계열과 잘 맞아요.',
      },
    })
    expect(http.get).toHaveBeenCalledWith('/recommendations/personalized')
  })

  it('취향 테스트를 안 했으면(400) 테스트로 이끌 결과가 된다', async () => {
    http.get.mockRejectedValue(
      new ApiError(400, 'RECOMMENDATION_TASTE_TEST_REQUIRED', '취향 테스트'),
    )
    await expect(getPersonalRecommendation()).resolves.toEqual({
      status: 'needs-taste-test',
    })
  })

  it.each([
    [404, 'RECOMMENDATION_NOT_FOUND'],
    [503, 'RECOMMENDATION_REFRESH_FAILED'],
  ])('%i %s 는 "추천 없음" 결과다 — 다시 물어도 같다', async (status, code) => {
    http.get.mockRejectedValue(new ApiError(status, code, '없음'))
    await expect(getPersonalRecommendation()).resolves.toEqual({
      status: 'none',
    })
  })

  it('다시 셈하는 중(409)은 던진다 — 쿼리가 잠깐 뒤에 다시 묻는다', async () => {
    const busy = new ApiError(
      409,
      'RECOMMENDATION_REFRESH_IN_PROGRESS',
      '셈하는 중',
    )
    http.get.mockRejectedValue(busy)
    await expect(getPersonalRecommendation()).rejects.toBe(busy)
  })
})
