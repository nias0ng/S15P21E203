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
 * 지금은 정적 스냅샷이라 바뀌지 않습니다. 온보딩을 오가며 다시 받지 않도록
 * `staleTime` 을 넉넉히 둡니다. API 가 붙으면 이 값만 조정하면 됩니다.
 */
export const scentVectorsQuery = () =>
  queryOptions({
    queryKey: tasteKeys.scentVectors(),
    queryFn: getScentVectors,
    staleTime: Infinity,
  })
