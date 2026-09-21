import { queryOptions } from '@tanstack/react-query'

import { getMyTasteTest, getScentVectors } from './api'

export const tasteKeys = {
  all: ['taste'] as const,
  scentVectors: () => [...tasteKeys.all, 'scent-vectors'] as const,
  mine: () => [...tasteKeys.all, 'mine'] as const,
}

/** 온보딩을 띄울지 정하는 값이라 `staleTime` 을 두지 않습니다 — 앞 사람의 답이 남으면 안 됩니다. */
export const myTasteTestQuery = () =>
  queryOptions({
    queryKey: tasteKeys.mine(),
    queryFn: getMyTasteTest,
  })

/** 향수 200개의 계열 벡터. 지도를 다시 적재할 때만 바뀌어 `staleTime` 이 깁니다. */
export const scentVectorsQuery = () =>
  queryOptions({
    queryKey: tasteKeys.scentVectors(),
    queryFn: getScentVectors,
    staleTime: 1000 * 60 * 60,
  })
