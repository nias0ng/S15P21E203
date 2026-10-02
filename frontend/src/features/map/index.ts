/**
 * 향 지도 도메인 공개 API (MAP-01 ~ MAP-24)
 *
 * 이 폴더 밖에서는 `@/features/map` 만 import 합니다.
 * 화면: A01 랜딩 · 향 지도 / A02 포인트 선택 / A03 유사 향수 탐색
 *
 * A01 은 3D 엔진(paperboat)입니다 — ScentScene 이 landing/ 의 엔진 페이지를 띄웁니다.
 */
// 로딩 커튼의 향 안개 · 걷힘 (SceneBootCurtain). 배치는 컴포넌트의 Tailwind 입니다
import './scene-boot.css'
// 선실 말풍선의 색 · 비켜서기 · 꼬리 (2026-09-21). 줄의 내용과 크기는 컴포넌트의 Tailwind 입니다
import './cabin.css'

export { CabinBubble } from './components/CabinBubble'
export { SceneBootCurtain } from './components/SceneBootCurtain'
export { ScentScene, type ScenePerfumeRef } from './components/ScentScene'
export { SceneTourTip } from './components/SceneTourTip'
export { SceneSearchBar } from './components/SceneSearchBar'
export { TourSpotlight } from './components/TourSpotlight'
export { VoyageLog, type VoyageLogStatus } from './components/VoyageLog'
export { useExplorationMove } from './hooks/useExplorationMove'
export { useSaveBoatPosition } from './hooks/useSaveBoatPosition'
export { useSceneBoot } from './hooks/useSceneBoot'
export { useSceneQuality } from './hooks/useSceneQuality'
export { buildPerfumeIdIndex } from './lib/perfumeIdAt'
export { buildMapPerfumeLookup, withMapPerfumes } from './lib/mapPerfumeLookup'
export {
  explorationStateQuery,
  mapKeys,
  mapPerfumePointsQuery,
  mapPerfumesQuery,
  voyageLogQuery,
} from './queries'
