import { queryOptions } from '@tanstack/react-query'

import {
  getPerfumeDetail,
  getPerfumeNotes,
  getPerfumeReviewAggregates,
  getPerfumeReviews,
  getRelatedPerfumes,
  getReviewDetail,
  searchPerfumes,
} from './api'
import type { PerfumeSearchParams, PerfumeSearchResponse } from './types'

/** 상세의 구역을 전부 `detail(perfumeId)` 아래에 두어 한 줄로 무효화합니다 */
export const perfumeKeys = {
  all: ['perfumes'] as const,
  lists: () => [...perfumeKeys.all, 'list'] as const,
  list: (params: PerfumeSearchParams) =>
    [...perfumeKeys.lists(), params] as const,
  details: () => [...perfumeKeys.all, 'detail'] as const,
  detail: (perfumeId: number) => [...perfumeKeys.details(), perfumeId] as const,
  notes: (perfumeId: number) =>
    [...perfumeKeys.detail(perfumeId), 'notes'] as const,
  reviewAggregates: (perfumeId: number) =>
    [...perfumeKeys.detail(perfumeId), 'review-aggregates'] as const,
  reviews: (perfumeId: number, params: { page?: number; size?: number }) =>
    [...perfumeKeys.detail(perfumeId), 'reviews', params] as const,
  related: (perfumeId: number) =>
    [...perfumeKeys.detail(perfumeId), 'related'] as const,
}

/** 후기는 향수에 매달려 있지 않고 번호로 바로 열립니다(A12) */
export const reviewKeys = {
  all: ['reviews'] as const,
  detail: (reviewId: number) => [...reviewKeys.all, reviewId] as const,
}

export const perfumeListQuery = (params: PerfumeSearchParams) =>
  queryOptions({
    queryKey: perfumeKeys.list(params),
    queryFn: () => searchPerfumes(params),
  })

/** 향수를 고르는 모달(글에 향수 걸기 · 진열대 등록)에 세우는 후보 수 */
const PICK_SIZE = 20

function toPerfumePicks(result: PerfumeSearchResponse): {
  perfumeId: number
  name: string
  brand: string | null
  thumbnailUrl: string | null
}[] {
  return result.perfumes.map((perfume) => ({
    perfumeId: perfume.perfumeId,
    // 한국어 이름이 없는 향수가 있습니다 — 그때는 영문으로 부릅니다
    name: perfume.nameKo ?? perfume.name,
    brand: perfume.brandName ?? perfume.brandNameKo,
    thumbnailUrl: perfume.imageUrl,
  }))
}

/**
 * 향수를 고르는 모달의 후보. 모달은 향수 도메인을 몰라(ESLint) 화면이 이 쿼리로 후보를
 * 만들어 넘깁니다.
 *
 * **검색어를 치기 전에는 부르지 않습니다.** 백엔드 기본 정렬이 번호순이라, 조건 없이 부르면
 * 카탈로그의 번호 빠른 스물이 후보로 섭니다 — 고를 향수가 아니라 그냥 목록입니다.
 *
 * @param keyword 모달의 검색어
 * @returns `useQuery` 에 넘길 옵션. 결과는 `{ perfumeId, name, brand, thumbnailUrl }[]` 이고
 *   캐시는 같은 검색어의 `perfumeListQuery` 와 함께 씁니다
 */
export const perfumePickQuery = (keyword: string) =>
  queryOptions({
    queryKey: perfumeKeys.list({ keyword, size: PICK_SIZE }),
    queryFn: () => searchPerfumes({ keyword, size: PICK_SIZE }),
    enabled: keyword.trim().length > 0,
    select: toPerfumePicks,
  })

export const perfumeDetailQuery = (perfumeId: number) =>
  queryOptions({
    queryKey: perfumeKeys.detail(perfumeId),
    queryFn: () => getPerfumeDetail(perfumeId),
  })

export const perfumeNotesQuery = (perfumeId: number) =>
  queryOptions({
    queryKey: perfumeKeys.notes(perfumeId),
    queryFn: () => getPerfumeNotes(perfumeId),
  })

/** 요약 · 키워드 · 후기 수 · 계절을 한 요청으로 받습니다 */
export const perfumeReviewAggregatesQuery = (perfumeId: number) =>
  queryOptions({
    queryKey: perfumeKeys.reviewAggregates(perfumeId),
    queryFn: () => getPerfumeReviewAggregates(perfumeId),
  })

export const perfumeReviewsQuery = (
  perfumeId: number,
  params: { page?: number; size?: number } = {},
) =>
  queryOptions({
    queryKey: perfumeKeys.reviews(perfumeId, params),
    queryFn: () => getPerfumeReviews(perfumeId, params),
  })

/** 부를 때마다 조회수가 올라, 창을 다시 잡았다고 재요청하면 안 됩니다 */
export const reviewDetailQuery = (reviewId: number) =>
  queryOptions({
    queryKey: reviewKeys.detail(reviewId),
    queryFn: () => getReviewDetail(reviewId),
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })

/** 적재할 때 정해 둔 관계라 자주 바뀌지 않습니다 */
export const relatedPerfumesQuery = (perfumeId: number) =>
  queryOptions({
    queryKey: perfumeKeys.related(perfumeId),
    queryFn: () => getRelatedPerfumes(perfumeId),
  })
