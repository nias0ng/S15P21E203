/**
 * taste 도메인 공개 API (요구사항 TST-03)
 *
 * 이 폴더 밖에서는 `@/features/taste` 만 import 합니다.
 * 내부 파일(`./match`, `./queries`)을 직접 짚지 않습니다.
 *
 * 화면: 회원가입 직후 온보딩 스텝 (독립 라우트 없음)
 */
export { FamilyPicker } from './components/FamilyPicker'
export { TasteResultModal } from './components/TasteResultModal'
export { TasteTestStep } from './components/TasteTestStep'
export {
  MAX_PICKS,
  SCENT_FAMILIES,
  familyAdjective,
  familyAriaLabel,
  scentFamilyLabel,
} from './families'
export {
  PRIMARY_WEIGHT,
  SECONDARY_WEIGHT,
  buildTasteVector,
  cosineSimilarity,
  countCandidates,
  matchStartingPoint,
} from './match'
export { myTasteTestQuery, scentVectorsQuery, tasteKeys } from './queries'
export {
  SCENT_FAMILY_KEYS,
  type ScentFamilyKey,
  type ScentFamilyLabel,
  type ScentVector,
  type ScentWeights,
  type TasteMatch,
  type TasteMatchMode,
  type TasteTestRecord,
} from './types'
