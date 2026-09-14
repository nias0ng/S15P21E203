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

/**
 * 브랜드 상세(`/brands/:brandId`)가 쓰는 한 건.
 *
 * 목록에 없는 것은 소개 문구뿐이라 Brand 를 넓혀 씁니다. 목록 응답에까지 긴 글이
 * 실릴 이유가 없어서 상세에만 두었습니다.
 */
export interface BrandDetail extends Brand {
  /** ⚠️ 백엔드에 브랜드 소개 필드가 없습니다. api.ts 가 자리표시자를 채웁니다 */
  description: string
}

/**
 * 브랜드 상세의 향수 카드 한 장.
 *
 * 향수 도메인 타입(PerfumeSummary)을 쓰지 않습니다 — features 끼리는 import 할 수
 * 없습니다. 카드가 실제로 읽는 값만 정의하고, 화면(pages)이 PerfumeCard 에 넘깁니다.
 */
export interface BrandPerfume {
  perfumeId: number
  name: string
  /** 한글명. 없으면 null */
  nameKo: string | null
  imageUrl: string | null
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
