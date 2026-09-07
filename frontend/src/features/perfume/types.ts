/** 향 계열 (기능 명세 MAP-01 향 지도 조회 기준) */
export type ScentFamily =
  'FLORAL' | 'WOODY' | 'CITRUS' | 'ORIENTAL' | 'FRESH' | 'FOUGERE'

export interface PerfumeSummary {
  perfumeId: number
  name: string
  brand: string

  // ⚠️ 아래 두 필드는 현재 백엔드가 내려주지 않습니다.
  // COM-05 검색 응답(백엔드 PerfumeSummaryResponse)은 { perfumeId, name, brand } 뿐입니다.
  // thumbnailUrl 은 perfume_images, scentFamily 는 perfume_map_points + scent_regions
  // 조인이 필요해서 각 기능 이슈에서 추가될 예정입니다.
  //
  // 그래서 타입은 필수인데 런타임에는 undefined 로 들어옵니다. 타입 단정을 믿고
  // perfume.scentFamily.toLowerCase() 처럼 바로 쓰면 화면이 죽습니다.
  // 검색 결과 목록에서 쓸 때는 값이 없는 경우를 먼저 처리해주세요.
  // 백엔드에서 두 필드가 추가되면 이 주석을 지우면 됩니다.
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
  /** 향수명·브랜드명 검색어 */
  keyword?: string

  // ⚠️ 백엔드 컨트롤러는 keyword 만 받습니다. 이 값을 보내도 조용히 무시되고
  // 필터가 걸리지 않은 전체 결과가 내려옵니다. 향 계열 필터는 백엔드에 아직 없습니다.
  scentFamily?: ScentFamily

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
