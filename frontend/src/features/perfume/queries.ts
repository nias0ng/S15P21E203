import { queryOptions } from '@tanstack/react-query'

import { getPerfumeDetail, searchPerfumes } from './api'
import type { PerfumeSearchParams } from './types'

/**
 * 쿼리 키를 한 곳에 모아둡니다.
 * 무효화(invalidate) 할 때 perfumeKeys.all 처럼 상위 키만 지정하면 하위가 함께 갱신됩니다.
 */
export const perfumeKeys = {
  all: ['perfumes'] as const,
  lists: () => [...perfumeKeys.all, 'list'] as const,
  list: (params: PerfumeSearchParams) =>
    [...perfumeKeys.lists(), params] as const,
  details: () => [...perfumeKeys.all, 'detail'] as const,
  detail: (perfumeId: number) => [...perfumeKeys.details(), perfumeId] as const,
}

export const perfumeListQuery = (params: PerfumeSearchParams) =>
  queryOptions({
    queryKey: perfumeKeys.list(params),
    queryFn: () => searchPerfumes(params),
  })

export const perfumeDetailQuery = (perfumeId: number) =>
  queryOptions({
    queryKey: perfumeKeys.detail(perfumeId),
    queryFn: () => getPerfumeDetail(perfumeId),
  })
