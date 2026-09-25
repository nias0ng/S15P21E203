export interface Brand {
  brandId: number
  name: string
  nameKo: string | null
  logoUrl: string | null
}

export interface BrandsResponse {
  brands: Brand[]
}

export interface BrandDetail extends Brand {
  perfumeCount: number
}

export type BrandSort = 'NAME_KO' | 'NAME_EN' | 'PERFUME_COUNT'

export const DEFAULT_BRAND_SORT: BrandSort = 'PERFUME_COUNT'

/**
 * 서버가 `sort` 를 못 받았을 때 쓰는 값. NOTE: 화면 기본값과 다릅니다 — 둘을 한 상수로
 * 묶으면 알약은 '향수 많은 순' 인데 서버에는 아무것도 안 실려 abc 순이 돌아옵니다.
 */
export const SERVER_DEFAULT_BRAND_SORT: BrandSort = 'NAME_EN'

export const BRAND_SORTS = [
  { value: 'PERFUME_COUNT', label: '향수 많은 순' },
  { value: 'NAME_EN', label: 'abc 순' },
  { value: 'NAME_KO', label: '가나다순' },
] as const satisfies readonly { value: BrandSort; label: string }[]

export interface BrandSearchParams {
  keyword?: string
  sort?: BrandSort
}
