import { queryOptions } from '@tanstack/react-query'

import { getBrands } from './api'
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
 * 브랜드 한 곳. **브랜드 상세 엔드포인트가 없어 목록에서 골라냅니다.**
 *
 * 목록이 페이지 없이 전부 오기 때문에 가능한 방법입니다. 조건 없는 목록과 키가
 * 같아서, 브랜드 페이지에서 카드를 눌러 들어오면 이미 받아 둔 목록을 그대로 씁니다
 * (요청이 안 나갑니다). 주소로 바로 열었을 때만 한 번 받습니다.
 *
 * 없는 brandId 는 null 입니다. 화면이 "찾을 수 없습니다" 로 안내합니다.
 */
export const brandDetailQuery = (brandId: number) =>
  queryOptions({
    queryKey: brandKeys.list({}),
    queryFn: () => getBrands({}),
    staleTime: CATALOG_STALE_TIME,
    select: (brands) =>
      brands.find((brand) => brand.brandId === brandId) ?? null,
  })
