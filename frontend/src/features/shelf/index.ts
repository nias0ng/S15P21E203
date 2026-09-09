/**
 * 진열대 도메인 공개 API (SHF-01 ~ SHF-14, DTL-18 · DTL-19)
 *
 * 이 폴더 밖에서는 `@/features/shelf` 만 import 합니다.
 * 화면: A13 진열대 + 컬렉션 / A15 향수 등록 모달 2단계 / A11 진열대 저장 모달
 *
 * ShelfRow · ShelfItemPanel 은 지웠습니다. 진열대 세 칸을 가로로 늘어놓던 이전
 * 레이아웃의 조각인데, 시안이 한 진열장(DisplayCase)으로 합쳐지면서 아무 데서도
 * 부르지 않게 되었습니다. 되살릴 일이 생기면 git 이력에 있습니다.
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
export { ShelfDetailPanel } from './components/ShelfDetailPanel'
export {
  ShelfToolbar,
  type CollectionFilterValue,
} from './components/ShelfToolbar'
export { ShelfFooterStrip } from './components/ShelfFooterStrip'
export { DisplayCase } from './components/DisplayCase'
export { ShelfRegisterModal } from './components/ShelfRegisterModal'
export { ShelfSaveModal } from './components/ShelfSaveModal'
export { toPerfumeOption } from './lib'
export { shelfItemsQuery, shelfKeys } from './queries'
export {
  SHELF_CATEGORIES,
  SHELF_SLOTS,
  type PerfumeOption,
  type ShelfCategory,
  type ShelfItem,
  type ShelfRegisterInput,
} from './types'
