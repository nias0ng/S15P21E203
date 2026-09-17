/**
 * 노트 (와이어프레임 A35 노트 목록 · A36 노트 상세)
 *
 * 이 폴더 밖에서는 `@/features/note` 만 import 합니다.
 *
 * ⚠️ 노트는 기능 명세서에 요구사항 ID 가 없는 신규 화면입니다(명세서 이후 수정 예정).
 */
export { NoteCategorySections } from './components/NoteCategorySections'
export { filterByFamily, UNCATEGORIZED } from './grouping'
export {
  noteDetailQuery,
  noteFamiliesQuery,
  noteKeys,
  noteListQuery,
  notePerfumesQuery,
} from './queries'
export type { Note, NotePerfume, NotePerfumesResponse } from './types'
