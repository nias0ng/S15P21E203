import { queryOptions } from '@tanstack/react-query'

import { getPersonalRecommendation, getRecommendation } from './api'

const recommendKeys = {
  all: ['recommend'] as const,
  byQuery: (query: string) => [...recommendKeys.all, query] as const,
  personal: () => [...recommendKeys.all, 'personal'] as const,
}

export const recommendationQuery = (query: string) =>
  queryOptions({
    queryKey: recommendKeys.byQuery(query),
    queryFn: () => getRecommendation(query),
  })

/**
 * 개인화 추천. staleTime 이 깁니다 — 진열대에 향수를 담을 때마다 다른 추천이
 * 튀어나오면 카드가 광고처럼 보입니다.
 */
export const personalRecommendationQuery = () =>
  queryOptions({
    queryKey: recommendKeys.personal(),
    queryFn: getPersonalRecommendation,
    staleTime: 1000 * 60 * 30,
  })
