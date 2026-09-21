import type { ScentFamilyKey } from '@/shared/config/scentFamilies'

/** COM-05 검색 결과의 한 건. 목록·검색·그리드가 이 형태를 씁니다. */
export interface PerfumeSummary {
  perfumeId: number
  name: string
  /** 한글명. 없는 향수는 null */
  nameKo: string | null
  /** 브랜드 **영문** 이름. 브랜드가 없는 향수는 null */
  brandName: string | null
  /** 자주 null 입니다 — 카드는 null 이면 `brandName`(영문)으로 대신합니다 */
  brandNameKo: string | null
  /** 대표 이미지. 등록된 이미지가 없으면 null */
  imageUrl: string | null
  /**
   * 대표 계열 하나. 향수는 1~3개를 갖는데 백엔드가 **비중이 가장 큰 하나**만
   * 보냅니다(`scent_regions.code`). 향 지도에 자리가 없으면 null 입니다.
   * 열린 문자열이라 여기 없는 값도 옵니다 — `scentFamilyName()` 을 거치세요.
   */
  scentFamily: ScentFamilyKey | null
}

/**
 * DTL-01 향수 기본 정보. **PerfumeSummary 를 상속하지 않습니다** — 검색은
 * `brandName`·`imageUrl`, 상세는 `brand`·`images` 라 묶으면 타입이 거짓말을 합니다.
 * 향조 · 계절 · 요약 · 후기는 **각각 별도 엔드포인트**입니다.
 */
export interface PerfumeDetail {
  perfumeId: number
  name: string
  nameKo: string | null
  gender: GenderFilter | null
  /*
   * ⚠️ **브랜드 공식 향 설명(`description`)은 일부러 빼 두었습니다.** 응답에는 아직
   * 들어 있지만 값의 신뢰성 문제로 걷어내기로 했고 화면 어디에서도 쓰지 않습니다.
   */
  concentration: string | null
  /** 검색과 달리 객체입니다 */
  brand: { brandId: number; name: string } | null
  /** 대표 이미지는 첫 번째 원소입니다 */
  images: string[]
  prices: PerfumePrice[]
  /**
   * 이 향수에 내가 쓴 후기 번호(없거나 비로그인이면 null). 한 사람이 한 향수에
   * 하나만 쓸 수 있어, 값이 있으면 [후기 수정] 입니다 — 또 쓰면 409.
   */
  myReviewId: number | null
}

interface PerfumePrice {
  volumeMl: number | null
  minPrice: number | null
  maxPrice: number | null
  /** ⚠️ UTC 로 옵니다 (2026-09-05T09:00:00Z). 화면에 쓸 때 KST 로 바꾸세요 */
  collectedAt: string
}

export interface PerfumeSearchParams {
  /** 향수명·브랜드명 검색어 */
  keyword?: string

  // ⚠️ 응답 필드로만 있습니다. 검색 파라미터로는 아직 안 먹어 보내도 무시됩니다
  scentFamily?: ScentFamilyKey

  /**
   * A33 위 줄 필터. **이름이 shelf 였는데 ranking 으로 바뀌었습니다** — 옛 이름은
   * @ModelAttribute 가 조용히 무시해 오류 없이 안 걸립니다. 전체 사용자 집계라
   * 로그인이 필요 없고, OWNED · WISH 는 세 명 이상 · sort 는 무시됩니다.
   */
  ranking?: RankingFilter

  /** A33 아래 줄 필터. 정의되지 않은 값을 보내면 400 입니다 */
  gender?: GenderFilter

  /** 브랜드명 **완전 일치**. 부분 일치는 keyword 가 담당합니다 */
  brand?: string

  /** 0부터 시작합니다 (Spring Pageable 기준). 첫 페이지는 0 입니다. */
  page?: number
  /** 백엔드 기본값 20 */
  size?: number

  // 백엔드는 sort 도 받습니다 (@PageableDefault(sort = "id")).
  // 정렬 옵션이 화면에 필요해지면 여기에 추가하세요.
}

/**
 * 향수 검색 응답. 백엔드와 1:1 이라 **공용 Page<T> 를 쓰지 않습니다** — 목록 필드가
 * content 가 아니라 perfumes 이고 totalPages 도 없습니다(`totalElements / size`).
 */
export interface PerfumeSearchResponse {
  perfumes: PerfumeSummary[]
  /** 현재 페이지. 0부터 시작합니다. */
  page: number
  size: number
  totalElements: number
}

/** A33 위 줄 필터 — **전체 사용자 집계**입니다. 내 진열대가 아닙니다 */
export type RankingFilter = 'OWNED' | 'WISH' | 'VIEWED'

/** A33 아래 줄 필터 — 향의 성별 */
export type GenderFilter = 'FEMALE' | 'MALE' | 'UNISEX'

export const RANKING_FILTERS = [
  { value: 'OWNED', label: '보유' },
  { value: 'WISH', label: '희망' },
  { value: 'VIEWED', label: '조회' },
] as const satisfies readonly { value: RankingFilter; label: string }[]

export const GENDER_FILTERS = [
  { value: 'FEMALE', label: '여성' },
  { value: 'MALE', label: '남성' },
  { value: 'UNISEX', label: '중성' },
] as const satisfies readonly { value: GenderFilter; label: string }[]

/**
 * 주소(`?ranking=` · `?gender=`)에서 읽은 필터 값을 걸러냅니다
 * (S15P21E203-362 로 필터가 URL 로 옮겨 왔습니다).
 *
 * 주소는 사람이 고쳐 쓸 수 있고 남이 보낸 링크로도 들어옵니다. **모르는 값은 "안
 * 걸림"(`null`) 으로 봅니다** — 그대로 API 에 실으면 400 이라 화면이 통째로 빕니다.
 * 표에 있는 값만 통과시키므로 라벨을 늘리면 받는 값도 같이 늘어납니다.
 */
function readFilter<T extends string>(
  value: string | null,
  options: readonly { value: T }[],
): T | null {
  return options.some((option) => option.value === value) ? (value as T) : null
}

export const readRankingFilter = (value: string | null): RankingFilter | null =>
  readFilter(value, RANKING_FILTERS)

export const readGenderFilter = (value: string | null): GenderFilter | null =>
  readFilter(value, GENDER_FILTERS)

/**
 * 영문 줄에 적는 성별. ⚠️ **표에 없는 값이면 아무것도 안 적습니다** — 타입은
 * `GenderFilter` 지만 백엔드 컬럼이 제약 없는 `VARCHAR(30)` 입니다.
 */
export const GENDER_TEXT: Record<GenderFilter, string> = {
  FEMALE: 'female',
  MALE: 'male',
  UNISEX: 'unisex',
}

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

/* ── DTL-02 향조 (GET /perfumes/{id}/notes) ─────────────────── */

/**
 * 향수를 이루는 노트 한 건. `noteType` 은 컬럼에 값 제약이 없어 그대로 내려옵니다 —
 * 보통 TOP · MIDDLE · BASE 지만 다른 값도 와서 **묶는 일은 화면이 합니다**.
 */
export interface PerfumeNote {
  noteId: number
  name: string
  noteType: string | null
}

/** 향수의 어코드 한 건. rank 가 작을수록 두드러집니다 */
interface PerfumeAccord {
  accordId: number
  name: string
  rank: number | null
  weight: number | null
}

/** 향조가 없는 향수는 두 목록이 빈 배열입니다 — 404 가 아닙니다 */
export interface PerfumeNotesResponse {
  notes: PerfumeNote[]
  accords: PerfumeAccord[]
}

/* ── DTL-14 계절별 평가 (GET /perfumes/{id}/season-statistics) ─ */

/**
 * 계절 하나의 후기 통계. 후기 하나가 계절을 여러 개 골라 **합이 100 을 넘습니다** —
 * 원형 차트나 누적 막대에 쓰면 안 됩니다.
 */
export interface SeasonStatistic {
  seasonId: number
  code: Season
  /** 봄 · 여름 · 가을 · 겨울 */
  name: string
  count: number
  /** 0~100, 소수점 한 자리 */
  percentage: number
}

/** 계절 네 개가 항상 옵니다. 후기가 없는 향수도 0 으로 채워 내려줍니다. */
export interface SeasonStatisticsResponse {
  seasons: SeasonStatistic[]
}

/* ── DTL-23 AI 후기 요약 (GET /perfumes/{id}/review-summary) ─── */

/**
 * 요약이 아직 없는 향수는 **세 값이 모두 null 인 200** 입니다. 후기가 최소 개수만큼
 * 쌓이기 전에는 배치가 요약을 만들지 않습니다.
 */
export interface ReviewSummary {
  /** 문장 배열이 아니라 한 덩어리 글입니다 */
  summary: string | null
  /** 요약을 만들 때 쓴 후기 수. ReviewStatistics.reviewCount 와 비교하면 최신인지 압니다 */
  sourceReviewCount: number | null
  /** ISO 8601 */
  updatedAt: string | null
}

/** DTL-10 후기 통계 (GET /perfumes/{id}/review-statistics). 평균 평점은 없습니다 */
export interface ReviewStatistics {
  reviewCount: number
}

/* ── DTL-03 후기 (GET /perfumes/{id}/reviews · /reviews/{id}) ── */

/** 후기에 걸린 계절 한 건 */
interface ReviewSeason {
  seasonId: number
  code: Season
  name: string
}

/** 향수 상세의 후기 목록 한 줄 */
export interface Review {
  reviewId: number
  /** 탈퇴한 회원의 후기는 글만 남고 작성자가 지워집니다 */
  nickname: string | null
  title: string
  content: string
  /** 고르지 않았으면 빈 배열 */
  seasons: ReviewSeason[]
  /** 내가 쓴 후기면 수정 · 삭제 버튼을 보여줍니다 (DTL-05 · DTL-06) */
  mine: boolean
  /** ISO 8601 */
  createdAt: string
  updatedAt: string
}

export interface ReviewsResponse {
  reviews: Review[]
  /** 0부터 시작합니다 */
  page: number
  size: number
  totalElements: number
}

/**
 * A12 후기 상세. `viewCount` 는 **이번 조회를 포함한** 수입니다 — 열었는데 숫자가
 * 그대로면 안 오른 것처럼 보이기 때문입니다.
 */
export interface ReviewDetail {
  reviewId: number
  nickname: string | null
  title: string
  content: string
  perfume: { perfumeId: number; name: string; brand: string | null }
  seasons: ReviewSeason[]
  likeCount: number
  viewCount: number
  /** 비로그인은 항상 false */
  liked: boolean
  mine: boolean
  createdAt: string
  updatedAt: string
}

/* ── 후기 쓰기 (CMT-03 · DTL-05 · DTL-06 · DTL-16) ──────────── */

/**
 * 후기 작성 요청 (POST /perfumes/{perfumeId}/reviews). 길이 제약은 백엔드
 * `ReviewCreateRequest` 그대로이고 **계절은 1개 이상 필수**(`@NotEmpty`)입니다.
 * 계절은 번호가 아니라 **코드**로 보냅니다 — `season_id` 는 환경마다 다릅니다.
 */
export interface ReviewCreateInput {
  title: string
  content: string
  seasonCodes: Season[]
}

export const REVIEW_TITLE_MAX_LENGTH = 50
export const REVIEW_CONTENT_MIN_LENGTH = 10
export const REVIEW_CONTENT_MAX_LENGTH = 1000

/**
 * 후기 수정 요청 (PATCH /reviews/{reviewId}). **둘 다 생략할 수 없습니다**(서버
 * `@AssertTrue`). **향수와 계절은 여기로 못 바꿉니다** — 향수는 경로가 없고
 * 계절은 `PUT /reviews/{reviewId}/seasons` 입니다.
 */
export interface ReviewUpdateInput {
  title?: string
  content?: string
}

/** POST /perfumes/{perfumeId}/reviews 응답 */
export interface ReviewCreateResponse {
  reviewId: number
  title: string
  content: string
  seasonCodes: Season[]
  createdAt: string
}

/** PUT /reviews/{reviewId}/seasons 응답 */
export interface ReviewSeasonsResponse {
  reviewId: number
  seasonCodes: Season[]
}

/**
 * PUT · DELETE /reviews/{reviewId}/like 응답. `liked` 와 `likeCount` 가 함께 와서
 * 화면이 숫자를 직접 더하고 빼지 않습니다.
 */
export interface ReviewLikeResponse {
  reviewId: number
  liked: boolean
  likeCount: number
}

/* ── 향수 상세의 곁 정보 (DTL) ──────────────────────────────── */

/**
 * 비슷한 향수 한 건. **`/similar` 과 `/neighbors` 가 같은 데이터를 줍니다** —
 * 화면은 하나만 부릅니다. 향 지도에 실린 200개 밖은 빈 배열입니다.
 */
export interface RelatedPerfume {
  perfumeId: number
  /** 영문 이름 */
  name: string
  /** 한국어 이름. 없는 향수가 있습니다 */
  nameKo: string | null
  imageUrl: string | null
}

export interface RelatedPerfumesResponse {
  perfumes: RelatedPerfume[]
}

/**
 * 후기에서 뽑힌 향 표현 한 개. `percentage` 의 분모는 **키워드가 하나라도 뽑힌
 * 후기 수**이고, 후기 하나에서 여러 개가 나와 **합이 100 을 넘습니다**.
 */
export interface ReviewKeyword {
  keyword: string
  /** 0~100, 소수점 한 자리 */
  percentage: number
}

export interface ReviewKeywordsResponse {
  keywords: ReviewKeyword[]
}
