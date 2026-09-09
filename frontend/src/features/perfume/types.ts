/** 향 계열 (기능 명세 MAP-01 향 지도 조회 기준) */
export type ScentFamily =
  'FLORAL' | 'WOODY' | 'CITRUS' | 'ORIENTAL' | 'FRESH' | 'FOUGERE'

export interface PerfumeSummary {
  perfumeId: number
  name: string
  brand: string

  /** 대표 이미지. 등록된 이미지가 없는 향수는 null 로 옵니다 */
  thumbnailUrl: string | null

  // ⚠️ 백엔드가 아직 안 내려줍니다. perfume_map_points + scent_regions 조인이
  // 필요해서 향 지도 기능 이슈에서 추가될 예정입니다.
  // 옵셔널로 둔 이유는 아래 PerfumeDetail 의 주석과 같습니다.
  scentFamily?: ScentFamily
}

/**
 * DTL-01 향수 기본 정보 조회
 *
 * ⚠️ 아래 세 필드는 백엔드 응답에 아직 없습니다. 백엔드 PerfumeDetailResponse 는
 * { perfumeId, name, brand, thumbnailUrl, description } 뿐이고, 향조·후기 통계는
 * 기능 명세가 별도 기능으로 분리해 두어 각각의 이슈에서 추가됩니다.
 *
 * **필수로 선언하면 타입은 통과하는데 런타임에 undefined 라 화면이 죽습니다.**
 * 실제로 그렇게 죽었습니다 — 백엔드에 상세 API 가 붙기 전에는 요청이 404 로 끝나
 * 이 코드까지 오지 않았을 뿐입니다(S15P21E203-169).
 *
 * 그래서 옵셔널로 둡니다. 백엔드가 내려주기 시작하면 `?` 를 떼고 이 주석을 지우세요.
 * 쓰는 쪽은 값이 없는 경우를 먼저 처리해야 합니다.
 */
export interface PerfumeDetail extends PerfumeSummary {
  description: string
  /** DTL-02 향조 정보 */
  notes?: {
    top: string[]
    middle: string[]
    base: string[]
  }
  /** DTL-10 후기 통계 */
  reviewCount?: number
  averageScore?: number
}

export interface PerfumeSearchParams {
  /** 향수명·브랜드명 검색어 */
  keyword?: string

  // ⚠️ 백엔드 컨트롤러는 keyword 만 받습니다. 이 값을 보내도 조용히 무시되고
  // 필터가 걸리지 않은 전체 결과가 내려옵니다. 향 계열 필터는 백엔드에 아직 없습니다.
  scentFamily?: ScentFamily

  // ⚠️ A33 의 필터 두 줄입니다. 백엔드에 아직 없어서 보내도 무시됩니다.
  // 진열대 기준 필터는 로그인 사용자의 진열대와 조회 이력을 봐야 하므로
  // 백엔드 작업이 함께 필요합니다.
  shelf?: ShelfFilter
  gender?: GenderFilter

  /**
   * 브랜드명. A34 브랜드 페이지에서 카드를 누르면 이 필터가 걸린 채로 옵니다
   * ("브랜드를 누르면 그 브랜드의 향수 목록").
   * ⚠️ 백엔드 검색 API 는 아직 keyword 만 받아 이 값도 무시됩니다.
   */
  brand?: string

  /** 0부터 시작합니다 (Spring Pageable 기준). 첫 페이지는 0 입니다. */
  page?: number
  /** 백엔드 기본값 20 */
  size?: number

  // 백엔드는 sort 도 받습니다 (@PageableDefault(sort = "id")).
  // 정렬 옵션이 화면에 필요해지면 여기에 추가하세요.
}

/** 백엔드 common/PageResponse.java 와 1:1 로 맞춰진 형태입니다. 필드명을 바꾸면 함께 깨집니다. */
export interface Page<T> {
  content: T[]
  /** 현재 페이지. 0부터 시작합니다. */
  page: number
  size: number
  totalElements: number
  totalPages: number
}

/** A33 위 줄 필터 — 내 진열대 기준. 로그인 상태에서만 의미가 있습니다. */
export type ShelfFilter = 'OWNED' | 'WISH' | 'VIEWED'

/** A33 아래 줄 필터 — 향의 성별 */
export type GenderFilter = 'FEMALE' | 'MALE' | 'UNISEX'

export const SHELF_FILTERS = [
  { value: 'OWNED', label: '보유' },
  { value: 'WISH', label: '희망' },
  { value: 'VIEWED', label: '조회' },
] as const satisfies readonly { value: ShelfFilter; label: string }[]

export const GENDER_FILTERS = [
  { value: 'FEMALE', label: '여성' },
  { value: 'MALE', label: '남성' },
  { value: 'UNISEX', label: '중성' },
] as const satisfies readonly { value: GenderFilter; label: string }[]

/* ── A10 향수 상세에서 쓰는 것들 ───────────────────────────── */

/** 계절 (DTL-14 · DTL-16 · DTL-24) */
export type Season = 'SPRING' | 'SUMMER' | 'AUTUMN' | 'WINTER'

export const SEASONS = [
  { value: 'SPRING', label: '봄' },
  { value: 'SUMMER', label: '여름' },
  { value: 'AUTUMN', label: '가을' },
  { value: 'WINTER', label: '겨울' },
] as const satisfies readonly { value: Season; label: string }[]

// 진열대 분류(ShelfCategory)는 진열대 도메인의 어휘라 features/shelf 에 있습니다.

/** DTL-14 계절별 평가 비율. 계절을 여러 개 고를 수 있어 합이 100이 아닐 수 있습니다. */
export interface SeasonRating {
  season: Season
  /** 0~100 */
  percentage: number
}

/**
 * DTL-23 AI 후기 요약.
 *
 * 와이어프레임 주석: 후기를 AI가 요약해 문장으로 보여준다 — 퍼센트는 문장 안의
 * 수치로만 쓰고 막대는 쓰지 않는다. 호평 · 혹평 섞어 4문장까지.
 * 후기 수가 적으면 요약을 생성하지 않고 안내 문구를 보여줍니다.
 */
export interface ReviewSummary {
  /** 최대 4문장. 비어 있으면 후기가 부족한 것으로 보고 안내 문구를 띄웁니다. */
  sentences: string[]
}

/** DTL-03 후기 목록 항목 */
export interface Review {
  reviewId: number
  nickname: string
  content: string
  /** ISO 8601 */
  createdAt: string
  /** 내가 쓴 후기면 수정 · 삭제 버튼을 보여줍니다 (DTL-05 · DTL-06) */
  mine: boolean
}
