/**
 * 브랜드 도메인 타입 (와이어프레임 A34)
 *
 * 기능 명세서에 요구사항 ID 가 없는 신규 화면입니다(명세서 이후 추가).
 */

/**
 * 브랜드 카드 한 장. **이름이 둘입니다**(`name` 영문 · `nameKo` 한국어). 향수 수는
 * 담기지 않습니다 — 브랜드가 7,793개라 필드 하나가 133KB 여서 뺐고, '향수 많은 순'
 * 정렬은 SQL 안에서 끝납니다.
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
 * 브랜드 한 곳 (`GET /brands/{brandId}`). **목록과 달리 향수 수가 옵니다** —
 * 목록에서 뺀 것은 크기 때문이고 한 건에는 그 사정이 없습니다.
 */
export interface BrandDetail extends Brand {
  /** 이 브랜드의 활성 향수 수 */
  perfumeCount: number
}

/**
 * A34 정렬. 이름이 `NAME` 하나가 아닌 것은 브랜드가 이름을 둘 가져, 어느 쪽으로
 * 줄 세우는지가 값에 드러나야 해서입니다.
 */
export type BrandSort = 'NAME_KO' | 'NAME_EN' | 'PERFUME_COUNT'

/**
 * **화면이 처음 켜 두는 정렬** (S15P21E203-364). 브랜드가 7,793개라 abc 순으로
 * 열면 첫 쪽이 숫자 · 기호로 시작하는 낯선 이름으로 찹니다. 향수가 많은 곳부터
 * 보이는 편이 "무엇부터 볼지" 에 답이 됩니다.
 */
export const DEFAULT_BRAND_SORT: BrandSort = 'PERFUME_COUNT'

/**
 * **서버가 `sort` 를 못 받았을 때 쓰는 값** (`BrandController` 의
 * `@RequestParam(defaultValue = "NAME_EN")`).
 *
 * ⚠️ 화면 기본값과 다릅니다. 둘을 한 상수로 묶으면 요청에서 `sort` 를 빼는 조건이
 * 화면 기본값을 따라가, 알약은 '향수 많은 순' 에 켜져 있는데 서버에는 아무것도 안
 * 실려 abc 순이 돌아옵니다 — 화면과 자료가 조용히 어긋납니다.
 */
export const SERVER_DEFAULT_BRAND_SORT: BrandSort = 'NAME_EN'

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
