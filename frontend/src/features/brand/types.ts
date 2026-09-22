/** 브랜드 도메인 타입 (와이어프레임 A34) */

export interface Brand {
  brandId: number
  name: string
  /** 아직 안 채워진 브랜드가 많아 자주 null 입니다 */
  nameKo: string | null
  logoUrl: string | null
}

export interface BrandsResponse {
  brands: Brand[]
}

/** 목록과 달리 향수 수가 옵니다 — 목록에서는 응답 크기 때문에 뺐습니다 */
export interface BrandDetail extends Brand {
  perfumeCount: number
}

export type BrandSort = 'NAME_KO' | 'NAME_EN' | 'PERFUME_COUNT'

/** 화면이 처음 켜 두는 정렬. abc 순으로 열면 첫 쪽이 숫자 · 기호 이름으로 찹니다 */
export const DEFAULT_BRAND_SORT: BrandSort = 'PERFUME_COUNT'

/**
 * 서버가 `sort` 를 못 받았을 때 쓰는 값. NOTE: 화면 기본값과 다릅니다 — 둘을 한 상수로
 * 묶으면 알약은 '향수 많은 순' 인데 서버에는 아무것도 안 실려 abc 순이 돌아옵니다.
 */
export const SERVER_DEFAULT_BRAND_SORT: BrandSort = 'NAME_EN'

export const BRAND_SORTS = [
  { value: 'NAME_EN', label: 'abc 순' },
  { value: 'NAME_KO', label: '가나다순' },
  { value: 'PERFUME_COUNT', label: '향수 많은 순' },
] as const satisfies readonly { value: BrandSort; label: string }[]

export interface BrandSearchParams {
  /** 한국어 · 영문 이름 양쪽에서 부분 일치로 찾습니다. 대소문자는 가리지 않습니다 */
  keyword?: string
  sort?: BrandSort
}
