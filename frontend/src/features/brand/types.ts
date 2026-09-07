/**
 * 브랜드 도메인 타입 (와이어프레임 A34)
 *
 * ⚠️ 브랜드는 기능 명세서에 요구사항 ID 가 없는 신규 화면입니다(명세서 이후 수정 예정).
 * 백엔드 API 도 아직 없습니다.
 */
export interface Brand {
  brandId: number
  name: string
  /** abc 정렬용 로마자 표기. 한글 브랜드는 이 값 기준으로 끼워 넣습니다. */
  romanizedName: string
  logoUrl: string | null
  /** 이 브랜드에 등록된 향수 수 */
  perfumeCount: number
}

/** A34 정렬. 기본은 abc 순입니다. */
export type BrandSort = 'NAME' | 'PERFUME_COUNT'

export const BRAND_SORTS = [
  { value: 'NAME', label: 'abc 순' },
  { value: 'PERFUME_COUNT', label: '향수 많은 순' },
] as const satisfies readonly { value: BrandSort; label: string }[]

export interface BrandSearchParams {
  keyword?: string
  sort?: BrandSort
}
