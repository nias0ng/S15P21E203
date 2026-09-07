/**
 * 향 지도 도메인 공개 API (MAP-01 ~ MAP-24)
 *
 * 이 폴더 밖에서는 `@/features/map` 만 import 합니다.
 * 화면: A01 랜딩 · 향 지도 / A02 포인트 선택 / A03 유사 향수 탐색
 *
 * ⚠️ 지도 라이브러리를 아직 정하지 않아 ScentMap 이 SVG 자리표시자입니다.
 * 라이브러리를 정하면 ScentMap 만 갈아끼우면 되도록 props 를 고정해 두었습니다.
 */
export { MapPointPopover } from './components/MapPointPopover'
export { MiniMap } from './components/MiniMap'
export { ScentMap } from './components/ScentMap'
export { SimilarExplorer } from './components/SimilarExplorer'
export { VoyageLog } from './components/VoyageLog'
export {
  mapKeys,
  mapPointsQuery,
  tasteAreaQuery,
  voyageLogQuery,
} from './queries'
export {
  SCENT_REGIONS,
  type MapPoint,
  type ScentRegionId,
  type Viewport,
  type VoyageLogEntry,
} from './types'
