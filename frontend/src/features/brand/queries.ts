import { queryOptions } from '@tanstack/react-query'

import { getBrand, getBrands } from './api'
import { SERVER_DEFAULT_BRAND_SORT, type BrandSearchParams } from './types'

// NOTE: 요청에서 뺄 수 있는 것은 **서버 기본 정렬**일 때뿐입니다
function normalize(params: BrandSearchParams): BrandSearchParams {
  const keyword = params.keyword?.trim()
  return {
    ...(keyword ? { keyword } : {}),
    ...(params.sort && params.sort !== SERVER_DEFAULT_BRAND_SORT
      ? { sort: params.sort }
      : {}),
  }
}

const brandKeys = {
  all: ['brands'] as const,
  lists: () => [...brandKeys.all, 'list'] as const,
  list: (params: BrandSearchParams) =>
    [...brandKeys.lists(), normalize(params)] as const,
  detail: (brandId: number) => [...brandKeys.all, 'detail', brandId] as const,
}

const CATALOG_STALE_TIME = 1000 * 60 * 10

export const brandListQuery = (params: BrandSearchParams) =>
  queryOptions({
    queryKey: brandKeys.list(params),
    queryFn: () => getBrands(normalize(params)),
    staleTime: CATALOG_STALE_TIME,
  })

export const brandDetailQuery = (brandId: number) =>
  queryOptions({
    queryKey: brandKeys.detail(brandId),
    queryFn: () => getBrand(brandId),
    staleTime: CATALOG_STALE_TIME,
  })
