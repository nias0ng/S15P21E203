/** 향 계열 (기능 명세 MAP-01 향 지도 조회 기준) */
export type ScentFamily =
  'FLORAL' | 'WOODY' | 'CITRUS' | 'ORIENTAL' | 'FRESH' | 'FOUGERE'

/** COM-05 검색 결과의 한 건. 목록·검색·그리드가 이 형태를 씁니다. */
export interface PerfumeSummary {
  perfumeId: number
  name: string
  /** 한글명. 없는 향수는 null */
  nameKo: string | null
  /** 브랜드명(문자열). 브랜드가 없는 향수는 null */
  brandName: string | null
  /** 대표 이미지. 등록된 이미지가 없으면 null */
  imageUrl: string | null
  scentFamily: ScentFamily | null
}

/**
 * DTL-01 향수 기본 정보 조회
 *
 * **PerfumeSummary 를 상속하지 않습니다.** 검색 응답과 필드 모양이 다릅니다.
 *   검색  brandName: string | null    imageUrl: string | null
 *   상세  brand: { brandId, name }    images: string[]
 * 상속으로 묶으면 타입이 거짓말을 하게 됩니다.
 *
 * ⚠️ 향조(notes)·후기 통계는 상세 응답에 없습니다. 별도 엔드포인트로 각각의
 * 이슈에서 붙습니다. 필수로 선언하면 타입은 통과하는데 런타임에 undefined 라
 * 화면이 죽습니다 — 실제로 그렇게 죽었습니다(S15P21E203-169).
 * 백엔드가 내려주기 시작하면 `?` 를 떼세요.
 */
export interface PerfumeDetail {
  perfumeId: number
  name: string
  nameKo: string | null
  gender: GenderFilter | null
  description: string | null
  concentration: string | null
  /** 검색과 달리 객체입니다 */
  brand: { brandId: number; name: string } | null
  /** 대표 이미지는 첫 번째 원소입니다 */
  images: string[]
  prices: PerfumePrice[]

  /** DTL-02 향조 정보 — 별도 엔드포인트에서 옵니다 */
  notes?: {
    top: string[]
    middle: string[]
    base: string[]
  }
  /** DTL-10 후기 통계 — 별도 엔드포인트에서 옵니다 */
  reviewCount?: number
  averageScore?: number
}

export interface PerfumePrice {
  volumeMl: number | null
  minPrice: number | null
  maxPrice: number | null
  /** ⚠️ UTC 로 옵니다 (2026-09-05T09:00:00Z). 화면에 쓸 때 KST 로 바꾸세요 */
  collectedAt: string
}

export interface PerfumeSearchParams {
  /** 향수명·브랜드명 검색어 */
  keyword?: string

  // ⚠️ scentFamily 는 응답 필드로만 있습니다. 검색 파라미터로는 아직 동작하지
  // 않아 보내도 무시됩니다. 필요해지면 백엔드에 요청해야 합니다.
  scentFamily?: ScentFamily

  /**
   * A33 위 줄 필터 — 내 진열대 기준.
   * ⚠️ 로그인이 필요합니다. 비로그인 요청에 보내면 401 이고 code 는
   * 'PERFUME_SHELF_FILTER_REQUIRES_LOGIN' 입니다. 백엔드에 인증이 아직 없어
   * 지금은 어떤 요청이든 401 입니다.
   */
  shelf?: ShelfFilter

  /** A33 아래 줄 필터. 정의되지 않은 값을 보내면 400 입니다 */
  gender?: GenderFilter

  /**
   * 브랜드명 **완전 일치**. A34 브랜드 페이지에서 카드를 누르면 이 필터가 걸린 채로
   * 옵니다. 부분 일치는 keyword 가 담당합니다.
   */
  brand?: string

  /** 0부터 시작합니다 (Spring Pageable 기준). 첫 페이지는 0 입니다. */
  page?: number
  /** 백엔드 기본값 20 */
  size?: number

  // 백엔드는 sort 도 받습니다 (@PageableDefault(sort = "id")).
  // 정렬 옵션이 화면에 필요해지면 여기에 추가하세요.
}

/**
 * 향수 검색 응답. 백엔드 PerfumeSearchResponse 와 1:1 입니다.
 *
 * **공용 Page<T> 를 쓰지 않습니다.** 목록 필드명이 content 가 아니라 perfumes 이고
 * totalPages 도 없습니다. 마지막 페이지가 필요하면
 * `Math.ceil(totalElements / size)` 로 구하세요.
 */
export interface PerfumeSearchResponse {
  perfumes: PerfumeSummary[]
  /** 현재 페이지. 0부터 시작합니다. */
  page: number
  size: number
  totalElements: number
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
