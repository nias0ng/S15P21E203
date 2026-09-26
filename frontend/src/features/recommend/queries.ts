import { queryOptions } from '@tanstack/react-query'

import { isApiError } from '@/shared/api/http'

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

/** 같은 사람의 후보를 서버가 다시 셈하는 중이라는 409 — 잠깐 뒤에 다시 물으면 됩니다 */
const REFRESH_IN_PROGRESS = 'RECOMMENDATION_REFRESH_IN_PROGRESS'

/**
 * 개인화 추천 편지 한 통 (S15P21E203-419).
 *
 * **9분 동안 새로 묻지 않습니다.** 부를 때마다 다른 병이 올 수 있어서(서버의 제비뽑기), 향수를 담을
 * 때마다 편지가 바뀌면 광고처럼 보입니다. 9분인 까닭은 편지의 손잡이가 10분만 살기 때문입니다 — 그보다
 * 오래 들고 있다가 편지를 열면 노출 기록이 404 로 빠집니다. 9분이 지나 화면에 다시 들어오면 새 편지를
 * 받습니다(열어 본 병은 사흘 동안 빠지므로 대개 다른 병입니다).
 *
 * 다른 오류는 전역 규칙(4xx 는 다시 묻지 않음)을 따르되, 409 만 1.2초 간격으로 세 번까지 다시 묻습니다.
 */
export const personalRecommendationQuery = () =>
  queryOptions({
    queryKey: recommendKeys.personal(),
    queryFn: getPersonalRecommendation,
    staleTime: 1000 * 60 * 9,
    retry: (failureCount, error) => {
      if (!isApiError(error)) return failureCount < 2
      if (error.code === REFRESH_IN_PROGRESS) return failureCount < 3
      return error.status >= 500 && failureCount < 2
    },
    retryDelay: 1200,
  })
