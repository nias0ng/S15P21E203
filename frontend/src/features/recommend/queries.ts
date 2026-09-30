import { queryOptions } from '@tanstack/react-query'

import { isApiError } from '@/shared/api/http'

import { getPersonalRecommendation, getRecommendation } from './api'

const recommendKeys = {
  all: ['recommend'] as const,
  byQuery: (query: string) => [...recommendKeys.all, query] as const,
  personal: () => [...recommendKeys.all, 'personal'] as const,
}

/**
 * 자연어 추천 한 번 (NLR-01). **결과창이 닫히면 담아 두지 않습니다**(`gcTime: 0`).
 *
 * 부를 때마다 서버가 새 기록과 설문 손잡이(`recommendationToken`)를 냅니다. 같은 말로 다시 찾을 때
 * 담아 둔 답을 꺼내면 이미 답했거나 닫은 손잡이가 와서 **만족도 설문이 걸리지 않습니다.** 담아 둔
 * 지 1분이 지났으면 옛 결과가 먼저 섰다가 뒤에서 받은 새 결과로 바뀌고, 그 사이에 창을 닫으면 새
 * 손잡이는 버려집니다.
 *
 * 열려 있는 동안은 다시 묻지 않습니다(`staleTime: Infinity`) — 보는 중에 카드가 바뀌면 안 됩니다.
 */
export const recommendationQuery = (query: string) =>
  queryOptions({
    queryKey: recommendKeys.byQuery(query),
    queryFn: () => getRecommendation(query),
    staleTime: Infinity,
    gcTime: 0,
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
