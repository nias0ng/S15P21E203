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

// 이름표는 화면 언어를 따라야 해 그리는 쪽이 `brand:sort.*` 로 풉니다
export const BRAND_SORTS = [
  { value: 'PERFUME_COUNT' },
  { value: 'NAME_EN' },
  { value: 'NAME_KO' },
] as const satisfies readonly { value: BrandSort }[]

export interface BrandSearchParams {
  keyword?: string
  sort?: BrandSort
}
