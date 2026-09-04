/** 향 계열 (기능 명세 MAP-01 향 지도 조회 기준) */
export type ScentFamily =
  'FLORAL' | 'WOODY' | 'CITRUS' | 'ORIENTAL' | 'FRESH' | 'FOUGERE'

export interface PerfumeSummary {
  perfumeId: number
  name: string
  brand: string
  thumbnailUrl: string | null
  scentFamily: ScentFamily
}

/** DTL-01 향수 기본 정보 조회 */
export interface PerfumeDetail extends PerfumeSummary {
  description: string
  /** DTL-02 향조 정보 */
  notes: {
    top: string[]
    middle: string[]
    base: string[]
  }
  /** DTL-10 후기 통계 */
  reviewCount: number
  averageScore: number
}

export interface PerfumeSearchParams {
  keyword?: string
  scentFamily?: ScentFamily
  page?: number
  size?: number
}

export interface Page<T> {
  content: T[]
  page: number
  size: number
  totalElements: number
  totalPages: number
}
