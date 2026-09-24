/**
 * 진열대 도메인 공개 API (SHF-01 ~ SHF-14, DTL-18 · DTL-19)
 *
 * 이 폴더 밖에서는 `@/features/shelf` 만 import 합니다.
 * 화면: A13 진열대 + 컬렉션 / A15 향수 등록 모달 2단계 / A11 진열대 저장 모달
 *
 * 진열대는 분류마다 벽감을 하나씩 가로로 이어 붙인 벽(ShelfWall)이고, 벽감 하나가
 * DisplayCase 입니다. ShelfDeck 은 진열대와 내 컬렉션을 위아래로 바꾸는 무대입니다.
 *
 * 백엔드 진열대 API 12개가 전부 붙어 있습니다(api.ts). 전부 로그인이 필요합니다.
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
export {
  createShelfItem,
  createShelfMemo,
  deleteShelfItem,
  deleteShelfMemo,
  updateShelfMemo,
} from './api'
export { ShelfDetailPanel } from './components/ShelfDetailPanel'
export {
  ShelfEditModal,
  type ShelfEditInput,
} from './components/ShelfEditModal'
export { ShelfItemFields } from './components/ShelfItemFields'
export { ShelfToolbar } from './components/ShelfToolbar'
export { ShelfFooterStrip } from './components/ShelfFooterStrip'
export { ShelfPager } from './components/ShelfPager'
export { ShelfPaper } from './components/ShelfPaper'
export { ShelfWall, type ShelfWallHandle } from './components/ShelfWall'
export { ShelfDeck } from './components/ShelfDeck'
export { ShelfRegisterModal } from './components/ShelfRegisterModal'
export {
  useShelfArrangement,
  type ShelfArrangement,
} from './hooks/useShelfArrangement'
export {
  ShelfEditPartialError,
  ShelfRegisterPartialError,
  useShelfActions,
} from './hooks/useShelfActions'
export { useShelfBrowser } from './hooks/useShelfBrowser'
export { toPerfumeOption } from './lib'
export { shelfItemDetailQuery, shelfItemsQuery, shelfKeys } from './queries'
export {
  SHELF_CATEGORIES,
  type PerfumeOption,
  type ShelfCategory,
  type ShelfCounts,
  type ShelfItem,
  type ShelfItemDetail,
  type ShelfScentNote,
  type ShelfRegisterInput,
  type ShelfSection,
} from './types'
