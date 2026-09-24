import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/shared/api/http'

import { getPerfumeReviewAggregates } from './api'

const http = vi.hoisted(() => ({ get: vi.fn() }))

vi.mock('@/shared/api/http', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, http }
})

/** 네 조각이 모두 차 있는 응답. 빈 값끼리는 조각이 뒤바뀌어도 똑같아 보입니다 */
const filled = {
  reviewSummary: {
    summary: '달콤한 향이 먼저 느껴진다는 의견이 많습니다.',
    sourceReviewCount: 16,
    updatedAt: '2026-09-10T04:22:58.535890Z',
  },
  reviewKeywords: {
    keywords: [
      { keyword: '달콤한', percentage: 81.8 },
      { keyword: '포근한', percentage: 36.4 },
    ],
  },
  reviewStatistics: { reviewCount: 16 },
  seasonStatistics: {
    seasons: [
      { seasonId: 1, code: 'SPRING', name: '봄', count: 2, percentage: 28.6 },
      { seasonId: 2, code: 'SUMMER', name: '여름', count: 1, percentage: 14.3 },
      { seasonId: 3, code: 'AUTUMN', name: '가을', count: 2, percentage: 28.6 },
      { seasonId: 4, code: 'WINTER', name: '겨울', count: 2, percentage: 28.6 },
    ],
  },
}

beforeEach(() => {
  http.get.mockReset()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('getPerfumeReviewAggregates', () => {
  it('통합 주소 한 곳만 부르고 size 는 키워드 상한으로 싣는다', async () => {
    http.get.mockResolvedValue({ data: filled })

    await getPerfumeReviewAggregates(135)

    expect(http.get).toHaveBeenCalledTimes(1)
    expect(http.get).toHaveBeenCalledWith('/perfumes/135/review-aggregates', {
      params: { size: 8 },
    })
  })

  it('size 를 주면 그 값을 싣는다', async () => {
    http.get.mockResolvedValue({ data: filled })

    await getPerfumeReviewAggregates(135, 3)

    expect(http.get).toHaveBeenCalledWith('/perfumes/135/review-aggregates', {
      params: { size: 3 },
    })
  })

  /**
   * 네 조각은 단건 엔드포인트가 내려주던 응답 그대로입니다. 화면이 옮겨올 수 있는 근거가
   * 이것이라, 중간에서 이름을 바꾸거나 껍질을 벗기지 않는지를 봅니다.
   */
  it('네 조각을 가공하지 않고 그대로 넘긴다', async () => {
    http.get.mockResolvedValue({ data: filled })

    const aggregates = await getPerfumeReviewAggregates(135)

    expect(aggregates).toEqual(filled)
  })

  /**
   * 빈 값의 모양이 조각마다 다릅니다 — 키워드는 빈 배열, 후기 수는 0, 계절은 배열,
   * 요약은 세 값이 모두 null 입니다. 한 덩어리로 묶였다고 통째로 null 이 되면 화면이
   * `?? []` 로 받는 자리에서 깨집니다.
   */
  it('백엔드에 닿지 못하면 조각마다 제 모양의 빈 값을 준다', async () => {
    http.get.mockRejectedValue(new ApiError(0, 'NETWORK', '닿지 못했습니다'))

    const aggregates = await getPerfumeReviewAggregates(135)

    expect(aggregates.reviewSummary).toEqual({
      summary: null,
      sourceReviewCount: null,
      updatedAt: null,
    })
    expect(aggregates.reviewKeywords.keywords).toEqual([])
    expect(aggregates.reviewStatistics.reviewCount).toBe(0)
    expect(aggregates.seasonStatistics.seasons).toEqual([])
  })

  /** 백엔드가 대답한 오류까지 삼키면 진짜 버그가 빈 화면에 가려집니다 */
  it('없는 향수의 404 는 대체값으로 덮지 않는다', async () => {
    http.get.mockRejectedValue(
      new ApiError(404, 'PERFUME_NOT_FOUND', '없는 향수입니다'),
    )

    await expect(getPerfumeReviewAggregates(999)).rejects.toThrow(ApiError)
  })
})
