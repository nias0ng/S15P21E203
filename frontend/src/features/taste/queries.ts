import { queryOptions } from '@tanstack/react-query'

import { getScentVectors } from './api'

/**
 * 쿼리 키를 한 곳에 모아둡니다.
 * 무효화할 때 `tasteKeys.all` 처럼 상위 키만 지정하면 하위가 함께 갱신됩니다.
 */
export const tasteKeys = {
  all: ['taste'] as const,
  scentVectors: () => [...tasteKeys.all, 'scent-vectors'] as const,
}

/**
 * 향수 200개의 계열 벡터.
 *
 * 지도를 다시 적재할 때만 바뀝니다. 온보딩에서 계열을 고르고 뒤로 갔다 다시 오는
 * 동안 200개를 또 받지 않도록 `staleTime` 을 길게 둡니다.
 *
 * 스냅샷을 쓰던 때는 `Infinity` 였는데, 이제 서버 값이라 한 시간으로 줄입니다 —
 * 적재가 돌았는데도 한 번 받은 값을 영원히 들고 있을 이유가 없습니다.
 */
export const scentVectorsQuery = () =>
  queryOptions({
    queryKey: tasteKeys.scentVectors(),
    queryFn: getScentVectors,
    staleTime: 1000 * 60 * 60,
  })
