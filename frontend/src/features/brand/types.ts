/**
 * 브랜드 도메인 타입 (와이어프레임 A34)
 *
 * 기능 명세서에 요구사항 ID 가 없는 신규 화면입니다(명세서 이후 추가).
 */

/**
 * 브랜드 카드 한 장.
 *
 * **이름이 둘입니다** — `name` 이 영문, `nameKo` 가 한국어입니다. 무엇을 크게 보여줄지는
 * 화면이 정하고 서버는 둘 다 보냅니다.
 *
 * 향수 수는 담기지 않습니다. 브랜드가 7,793개라 필드 하나가 133KB 라서 뺐습니다.
 * '향수 많은 순' 정렬은 그대로 있고, 세는 일은 SQL 안에서 끝납니다.
 */
export interface Brand {
  brandId: number
  /** 영문 이름 */
  name: string
  /** 한국어 이름. 아직 안 채워진 브랜드가 많아 자주 null 입니다 */
  nameKo: string | null
  /** 없으면 화면이 "로고" 자리표시자를 그립니다 */
  logoUrl: string | null
}

/**
 * 브랜드 목록 응답. **페이지 정보가 없습니다** — 브랜드 페이지는 전부를 한 화면에
 * 뿌리고, 브랜드 수는 향수처럼 계속 늘어나는 값이 아닙니다.
 */
export interface BrandsResponse {
  brands: Brand[]
}

/**
 * 브랜드 한 곳 (`GET /brands/{brandId}`).
 *
 * **목록과 달리 향수 수가 옵니다.** 목록에서 뺀 것은 브랜드 7,793개에 필드 하나가
 * 133KB 가 되기 때문이었고, 한 건에는 그 사정이 없습니다.
 */
export interface BrandDetail extends Brand {
  /** 이 브랜드의 활성 향수 수 */
  perfumeCount: number
}

/**
 * A34 정렬. 기본은 영문 abc 순입니다.
 *
 * 이름이 `NAME` 하나가 아닌 이유는 브랜드가 이름을 둘 갖기 때문입니다 —
 * 어느 이름으로 줄을 세우는지가 값에 드러나야 합니다.
 */
export type BrandSort = 'NAME_KO' | 'NAME_EN' | 'PERFUME_COUNT'

/** 백엔드 기본값과 같습니다. 같아야 "정렬을 고르지 않음" 과 한자리를 씁니다. */
export const DEFAULT_BRAND_SORT: BrandSort = 'NAME_EN'

export const BRAND_SORTS = [
  { value: 'NAME_EN', label: 'abc 순' },
  { value: 'NAME_KO', label: '가나다순' },
  { value: 'PERFUME_COUNT', label: '향수 많은 순' },
] as const satisfies readonly { value: BrandSort; label: string }[]

export interface BrandSearchParams {
  /** 한국어 · 영문 이름 **양쪽**에서 부분 일치로 찾습니다. 대소문자는 가리지 않습니다 */
  keyword?: string
  sort?: BrandSort
}
