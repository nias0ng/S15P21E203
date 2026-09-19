import { queryOptions } from '@tanstack/react-query'

import { getMyTasteTest, getScentVectors } from './api'

/**
 * 쿼리 키를 한 곳에 모아둡니다.
 * 무효화할 때 `tasteKeys.all` 처럼 상위 키만 지정하면 하위가 함께 갱신됩니다.
 */
export const tasteKeys = {
  all: ['taste'] as const,
  scentVectors: () => [...tasteKeys.all, 'scent-vectors'] as const,
  mine: () => [...tasteKeys.all, 'mine'] as const,
}

/**
 * 내 취향 테스트 기록. **로그인 직후 온보딩을 띄울지 정하는 값**이라 `staleTime` 을
 * 두지 않습니다 — 로그인한 사람이 달라지면 앞 사람의 답이 남아 있으면 안 됩니다.
 */
export const myTasteTestQuery = () =>
  queryOptions({
    queryKey: tasteKeys.mine(),
    queryFn: getMyTasteTest,
  })

/**
 * 향수 200개의 계열 벡터. 지도를 다시 적재할 때만 바뀌어 `staleTime` 이 깁니다.
 * 스냅샷을 쓰던 때는 `Infinity` 였지만 이제 서버 값이라 한 시간입니다.
 */
export const scentVectorsQuery = () =>
  queryOptions({
    queryKey: tasteKeys.scentVectors(),
    queryFn: getScentVectors,
    staleTime: 1000 * 60 * 60,
  })
