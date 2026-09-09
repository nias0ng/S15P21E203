/**
 * 진열대 도메인 공개 API (SHF-01 ~ SHF-14, DTL-18 · DTL-19)
 *
 * 이 폴더 밖에서는 `@/features/shelf` 만 import 합니다.
 * 화면: A13 진열대 + 컬렉션 / A15 향수 등록 모달 2단계 / A11 진열대 저장 모달
 *
 * ⚠️ 백엔드 진열대 API 가 아직 없습니다. api.ts 가 자리표시자를 돌려줍니다.
 */
export { CollectionDetailPanel } from './components/CollectionDetailPanel'
export {
  CollectionFilters,
  type CollectionFilterValue,
} from './components/CollectionFilters'
export { CollectionFooterStrip } from './components/CollectionFooterStrip'
export { DisplayCase } from './components/DisplayCase'
export { PerfumeRegisterModal } from './components/PerfumeRegisterModal'
export { ShelfItemPanel } from './components/ShelfItemPanel'
export { ShelfRow } from './components/ShelfRow'
export { ShelfSaveModal } from './components/ShelfSaveModal'
export { shelfItemsQuery, shelfKeys } from './queries'
export {
  SHELF_CATEGORIES,
  SHELF_SLOTS,
  type PerfumeOption,
  type ShelfCategory,
  type ShelfItem,
  type ShelfRegisterInput,
} from './types'
