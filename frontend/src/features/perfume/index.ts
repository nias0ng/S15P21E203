/**
 * perfume 도메인 공개 API (COM-05, DTL-01, DTL-02, DTL-10, DTL-25)
 *
 * 이 폴더 밖에서는 `@/features/perfume` 만 import 합니다.
 * `@/features/perfume/api` 처럼 내부 파일을 직접 짚지 않습니다.
 * 그래야 내부 파일을 쪼개거나 옮겨도 화면 코드가 안 깨집니다.
 */
export { perfumeDetailQuery, perfumeKeys, perfumeListQuery } from './queries'
export type {
  Page,
  PerfumeDetail,
  PerfumeSearchParams,
  PerfumeSummary,
  ScentFamily,
} from './types'
