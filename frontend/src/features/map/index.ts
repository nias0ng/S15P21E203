/**
 * 향 지도 도메인 공개 API (MAP-01 ~ MAP-24)
 *
 * 이 폴더 밖에서는 `@/features/map` 만 import 합니다.
 * 화면: A01 랜딩 · 향 지도 / A02 포인트 선택 / A03 유사 향수 탐색
 *
 * A01 은 3D 엔진(paperboat)입니다 — ScentScene 이 landing/ 의 엔진 페이지를 띄웁니다.
 * ScentMap 은 A06 추천 결과의 흐린 배경으로만 남은 SVG 자리표시자입니다.
 */
export { MapPointPopover } from './components/MapPointPopover'
export { MiniMap } from './components/MiniMap'
export { ScentMap } from './components/ScentMap'
export { ScentScene, type ScenePerfumeRef } from './components/ScentScene'
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
