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

//서버가 `sort` 를 못 받았을 때 쓰는 값.
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
