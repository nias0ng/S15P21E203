/**
 * 진열대 도메인 공개 API (SHF-01 ~ SHF-14, DTL-18 · DTL-19)
 *
 * 이 폴더 밖에서는 `@/features/shelf` 만 import 합니다.
 * 화면: A13 진열대 + 컬렉션 / A15 향수 등록 모달 2단계 / A11 진열대 저장 모달
 *
 * ⚠️ 백엔드 진열대 API 가 아직 없습니다. api.ts 가 자리표시자를 돌려줍니다.
 */

/*
 * 진열대 전용 시각 처리(`.shelf-scope` 아래로 한정). 컴포넌트가 아니라 도메인 입구에서
 * 부르는 이유: 그 컴포넌트를 지우는 사람이 다른 컴포넌트 스타일까지 떨어뜨립니다.
 */
import './shelf-display.css'
export { ShelfDetailPanel } from './components/ShelfDetailPanel'
export { ShelfToolbar } from './components/ShelfToolbar'
export { ShelfFooterStrip } from './components/ShelfFooterStrip'
export { DisplayCase } from './components/DisplayCase'
export { ShelfDeck } from './components/ShelfDeck'
export { ShelfRegisterModal } from './components/ShelfRegisterModal'
export { ShelfSaveModal } from './components/ShelfSaveModal'
export { useShelfBrowser } from './hooks/useShelfBrowser'
export { toPerfumeOption } from './lib'
export { shelfItemsQuery, shelfKeys } from './queries'
export {
  SHELF_CATEGORIES,
  SHELF_PAGE_STEP,
  SHELF_SLOT_COUNT,
  type PerfumeOption,
  type ShelfCategory,
  type ShelfCounts,
  type ShelfItem,
  type ShelfRegisterInput,
} from './types'
