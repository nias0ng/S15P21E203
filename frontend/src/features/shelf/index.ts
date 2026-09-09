/**
 * 진열대 도메인 공개 API (SHF-01 ~ SHF-14, DTL-18 · DTL-19)
 *
 * 이 폴더 밖에서는 `@/features/shelf` 만 import 합니다.
 * 화면: A13 진열대 + 컬렉션 / A15 향수 등록 모달 2단계 / A11 진열대 저장 모달
 *
 * ⚠️ 백엔드 진열대 API 가 아직 없습니다. api.ts 가 자리표시자를 돌려줍니다.
 */

/*
 * 진열대 화면 전용 시각 처리. 모든 규칙이 `.shelf-scope` 아래로 한정되어 있어
 * 이 도메인을 import 하는 다른 화면에는 아무 영향이 없습니다.
 *
 * 컴포넌트가 아니라 여기서 부르는 이유: 이 파일이 도메인의 유일한 입구라
 * "진열대 도메인은 스타일시트를 함께 싣는다" 를 한 곳에서 볼 수 있습니다.
 * 컴포넌트 안에 두면 그 컴포넌트를 지우는 사람이 다른 컴포넌트의 스타일까지
 * 조용히 떨어뜨립니다.
 */
import './shelf-display.css'
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
