/**
 * perfume 도메인 공개 API (COM-05, DTL-01, DTL-02, DTL-10, DTL-25)
 *
 * 이 폴더 밖에서는 `@/features/perfume` 만 import 합니다.
 * `@/features/perfume/api` 처럼 내부 파일을 직접 짚지 않습니다.
 * 그래야 내부 파일을 쪼개거나 옮겨도 화면 코드가 안 깨집니다.
 *
 * 화면: A33 향수 목록 / A09 검색 결과 / A10 상세 / A11 상세 모달 / A12 후기 상세
 */
export { PerfumeFilters } from './components/PerfumeFilters'
export { PerfumeGrid } from './components/PerfumeGrid'
export { PerfumeSearchResult } from './components/PerfumeSearchResult'
export { perfumeDetailQuery, perfumeKeys, perfumeListQuery } from './queries'
export {
  GENDER_FILTERS,
  SHELF_FILTERS,
  type GenderFilter,
  type Page,
  type PerfumeDetail,
  type PerfumeSearchParams,
  type PerfumeSummary,
  type ScentFamily,
  type ShelfFilter,
} from './types'
