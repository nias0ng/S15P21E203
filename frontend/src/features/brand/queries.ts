import { queryOptions } from '@tanstack/react-query'

import { getBrand, getBrands } from './api'
import { DEFAULT_BRAND_SORT, type BrandSearchParams } from './types'

/**
 * 빈 검색어와 기본 정렬은 **조건이 없는 것과 같습니다.** 캐시 키와 요청에서 함께
 * 빼야 조건 없는 목록과 같은 자리를 씁니다 — 안 빼면 `{keyword:''}` 와 `{}` 가
 * 서로 다른 키가 되어 같은 응답을 두 번 받습니다.
 */
function normalize(params: BrandSearchParams): BrandSearchParams {
  const keyword = params.keyword?.trim()
  return {
    ...(keyword ? { keyword } : {}),
    ...(params.sort && params.sort !== DEFAULT_BRAND_SORT
      ? { sort: params.sort }
      : {}),
  }
}

export const brandKeys = {
  all: ['brands'] as const,
  lists: () => [...brandKeys.all, 'list'] as const,
  list: (params: BrandSearchParams) =>
    [...brandKeys.lists(), normalize(params)] as const,
  detail: (brandId: number) => [...brandKeys.all, 'detail', brandId] as const,
}

/**
 * 브랜드 카탈로그는 자주 바뀌지 않습니다. 전체가 한 번에 오는 응답이라
 * 화면을 오갈 때마다 다시 받지 않도록 기본값(1분)보다 길게 둡니다.
 */
const CATALOG_STALE_TIME = 1000 * 60 * 10

export const brandListQuery = (params: BrandSearchParams) =>
  queryOptions({
    queryKey: brandKeys.list(params),
    queryFn: () => getBrands(normalize(params)),
    staleTime: CATALOG_STALE_TIME,
  })

/**
 * 브랜드 한 곳. 예전에는 상세 엔드포인트가 없어 목록 7,793개에서 골라냈습니다.
 * 없는 브랜드는 `null` 이 아니라 404 입니다.
 */
export const brandDetailQuery = (brandId: number) =>
  queryOptions({
    queryKey: brandKeys.detail(brandId),
    queryFn: () => getBrand(brandId),
    staleTime: CATALOG_STALE_TIME,
  })
