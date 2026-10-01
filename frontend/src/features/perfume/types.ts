import type { ScentFamilyKey } from '@/shared/config/scentFamilies'
import { readOption } from '@/shared/lib/queryParams'

export interface PerfumeSummary {
  perfumeId: number
  name: string
  nameKo: string | null
  brandName: string | null
  /** 자주 null 입니다 — 비면 카드가 `brandName`(영문)으로 대신합니다 */
  brandNameKo: string | null
  imageUrl: string | null
  /** 백엔드가 비중이 가장 큰 계열 하나만 보냅니다. 열린 문자열이라 `scentFamilyName()` 을 거치세요 */
  scentFamily: ScentFamilyKey | null
}

/**
 * **PerfumeSummary 를 상속하지 않습니다** — 검색은 `brandName`·`imageUrl`, 상세는
 * `brand`·`images` 라 묶으면 타입이 거짓말을 합니다.
 */
export interface PerfumeDetail {
  perfumeId: number
  name: string
  nameKo: string | null
  gender: GenderFilter | null
  /* NOTE: 응답의 `description`(브랜드 공식 향 설명)은 값의 신뢰성 문제로 화면 어디에서도 쓰지 않습니다 */
  concentration: string | null
  brand: { brandId: number; name: string } | null
  /** 대표 이미지는 첫 번째 원소입니다 */
  images: string[]
  prices: PerfumePrice[]
  /** 한 사람이 한 향수에 하나만 쓸 수 있어, 값이 있으면 [후기 수정] 입니다 — 또 쓰면 409 */
  myReviewId: number | null
  /**
   * 단종이 확인된 향수만 옵니다. **없으면 모르는 것**이지 판매 중이라는 뜻이 아닙니다 — 13만 개를
   * 다 판정하지 않습니다. 비어 있을 때 응답에서 칸이 빠져 옵니다(`undefined`).
   */
  productionStatus?: ProductionStatus | null
}

/** 확인된 생산 상태. 상세는 '단종' 만 그립니다 — 확인일 · 근거는 단종 목록을 고치는 팀이 봅니다 */
export interface ProductionStatus {
  status: 'DISCONTINUED'
  /** YYYY-MM-DD */
  checkedAt: string
  /** 판정 근거 URL */
  source: string
}

interface PerfumePrice {
  volumeMl: number | null
  minPrice: number | null
  maxPrice: number | null
  /** NOTE: UTC 로 옵니다. 화면에 쓸 때 KST 로 바꾸세요 */
  collectedAt: string
}

export interface PerfumeSearchParams {
  keyword?: string

  /**
   * 전체 사용자 집계라 로그인이 필요 없고, OWNED · WISH 는 세 명 이상 · sort 는 무시됩니다.
   * `POPULAR` 는 사용자 집계가 아니라 국내 선정 순위(향 지도 200개)입니다 — 필터 칩이 아니라
   * 목록의 기본 순서로만 씁니다 (`PerfumeListPage`)
   */
  ranking?: RankingFilter | 'POPULAR'

  /** A33 아래 줄 필터. 정의되지 않은 값을 보내면 400 입니다 */
  gender?: GenderFilter

  /** 이름으로 거르면 표기만 다른 중복 브랜드에서 저장된 이름과 어긋나 번호로 거릅니다 */
  brandId?: number

  /** 0부터 시작합니다 (Spring Pageable 기준) */
  page?: number
  /** 백엔드 기본값 20 */
  size?: number
}

/**
 * 향수 검색 응답. 백엔드와 1:1 이라 **공용 Page<T> 를 쓰지 않습니다** — 목록 필드가
 * content 가 아니라 perfumes 이고 totalPages 도 없습니다(`totalElements / size`).
 */
export interface PerfumeSearchResponse {
  perfumes: PerfumeSummary[]
  page: number
  size: number
  totalElements: number
}

/** A33 위 줄 필터 — **전체 사용자 집계**입니다. 내 진열대가 아닙니다 */
export type RankingFilter = 'OWNED' | 'WISH' | 'VIEWED'

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

export const readRankingFilter = (value: string | null): RankingFilter | null =>
  readOption(value, RANKING_FILTERS)

export const readGenderFilter = (value: string | null): GenderFilter | null =>
  readOption(value, GENDER_FILTERS)

/**
 * NOTE: 백엔드 컬럼이 제약 없는 `VARCHAR(30)` 이라 표에 없는 값이 오면 아무것도 안 적습니다.
 * 우리말로 적습니다 — 영문 소문자('unisex')는 원명 옆에서 이름의 일부처럼 읽혔습니다.
 */
export const GENDER_TEXT: Record<GenderFilter, string> = {
  FEMALE: '여성용',
  MALE: '남성용',
  UNISEX: '공용',
}

export type Season = 'SPRING' | 'SUMMER' | 'AUTUMN' | 'WINTER'

export const SEASONS = [
  { value: 'SPRING', label: '봄' },
  { value: 'SUMMER', label: '여름' },
  { value: 'AUTUMN', label: '가을' },
  { value: 'WINTER', label: '겨울' },
] as const satisfies readonly { value: Season; label: string }[]

// 진열대 분류(ShelfCategory)는 진열대 도메인의 어휘라 features/shelf 에 있습니다.

/** `noteType` 은 값 제약이 없어 그대로 내려옵니다 — **묶는 일은 화면이 합니다** */
export interface PerfumeNote {
  noteId: number
  name: string
  noteType: string | null
}

/** rank 가 작을수록 두드러집니다 */
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

/** 후기 하나가 계절을 여러 개 골라 **합이 100 을 넘습니다** — 원형 차트에 쓰면 안 됩니다 */
export interface SeasonStatistic {
  seasonId: number
  code: Season
  name: string
  count: number
  /** 0~100, 소수점 한 자리 */
  percentage: number
}

/** 계절 네 개가 항상 옵니다. 후기가 없는 향수도 0 으로 채워 내려줍니다 */
interface SeasonStatisticsResponse {
  seasons: SeasonStatistic[]
}

/** DTL-23 AI 후기 요약. 아직 요약이 없는 향수는 **세 값이 모두 null 인 200** 입니다 */
interface ReviewSummary {
  summary: string | null
  /** `ReviewStatistics.reviewCount` 와 비교하면 요약이 최신인지 압니다 */
  sourceReviewCount: number | null
  updatedAt: string | null
}

/** DTL-10 후기 통계. 평균 평점은 없습니다 */
interface ReviewStatistics {
  reviewCount: number
}

interface ReviewSeason {
  seasonId: number
  code: Season
  name: string
}

export interface Review {
  reviewId: number
  /** 탈퇴한 회원의 후기는 글만 남고 작성자가 지워집니다 */
  nickname: string | null
  title: string
  content: string
  seasons: ReviewSeason[]
  mine: boolean
  createdAt: string
  updatedAt: string
}

export interface ReviewsResponse {
  reviews: Review[]
  page: number
  size: number
  totalElements: number
}

export interface ReviewDetail {
  reviewId: number
  nickname: string | null
  /** 작성자 사진. 설정하지 않았거나 탈퇴한 작성자면 null 입니다 */
  profileImageUrl: string | null
  title: string
  content: string
  perfume: { perfumeId: number; name: string; brand: string | null }
  seasons: ReviewSeason[]
  likeCount: number
  /** **이번 조회를 포함한** 수입니다 */
  viewCount: number
  /** 비로그인은 항상 false */
  liked: boolean
  mine: boolean
  createdAt: string
  updatedAt: string
}

/** **계절은 1개 이상 필수**이고 번호가 아니라 코드로 보냅니다 — `season_id` 는 환경마다 다릅니다 */
export interface ReviewCreateInput {
  title: string
  content: string
  seasonCodes: Season[]
}

export const REVIEW_TITLE_MAX_LENGTH = 50
export const REVIEW_CONTENT_MIN_LENGTH = 10
export const REVIEW_CONTENT_MAX_LENGTH = 1000

/** **둘 다 생략하면 400** 이고 향수 · 계절은 못 바꿉니다 — 계절은 `PUT /reviews/{id}/seasons` 입니다 */
export interface ReviewUpdateInput {
  title?: string
  content?: string
}

export interface ReviewCreateResponse {
  reviewId: number
  title: string
  content: string
  seasonCodes: Season[]
  createdAt: string
}

export interface ReviewSeasonsResponse {
  reviewId: number
  seasonCodes: Season[]
}

/** `liked` 와 `likeCount` 가 함께 와서 화면이 숫자를 직접 더하고 빼지 않습니다 */
export interface ReviewLikeResponse {
  reviewId: number
  liked: boolean
  likeCount: number
}

export interface RelatedPerfume {
  perfumeId: number
  name: string
  nameKo: string | null
  imageUrl: string | null
}

export interface RelatedPerfumesResponse {
  perfumes: RelatedPerfume[]
}

/** 분모는 **키워드가 하나라도 뽑힌 후기 수**이고, 후기 하나에서 여러 개가 나와 **합이 100 을 넘습니다** */
export interface ReviewKeyword {
  keyword: string
  /** 0~100, 소수점 한 자리 */
  percentage: number
}

interface ReviewKeywordsResponse {
  keywords: ReviewKeyword[]
}

/**
 * 상세 화면이 함께 쓰는 후기 집계 네 조각입니다.
 *
 * 네 조각은 각각 단건 엔드포인트가 내려주던 응답 **그대로**입니다 — 빈 값의 모양도
 * 조각마다 그대로라, 키워드는 빈 배열 · 후기 수는 0 · 계절은 0 으로 채운 네 칸 ·
 * 요약은 세 값이 모두 null 입니다. 한 덩어리로 묶였다고 통째로 null 이 되지 않습니다.
 */
export interface ReviewAggregates {
  reviewSummary: ReviewSummary
  reviewKeywords: ReviewKeywordsResponse
  reviewStatistics: ReviewStatistics
  seasonStatistics: SeasonStatisticsResponse
}
