/**
 * 컬렉션 도메인 공개 API (COL-01 ~ COL-08)
 *
 * 이 폴더 밖에서는 `@/features/collection` 만 import 합니다.
 * 화면: A13 하단 컬렉션 목록 / A17 컬렉션 상세 / A19 컬렉션 모달 3종
 *
 * ⚠️ 백엔드 컬렉션 API 가 아직 없습니다. api.ts 가 자리표시자를 돌려줍니다.
 */
export { AddToCollectionModal } from './components/AddToCollectionModal'
export { CollectionFormModal } from './components/CollectionFormModal'
export { CollectionStrip } from './components/CollectionStrip'
export {
  collectionDetailQuery,
  collectionKeys,
  myCollectionsQuery,
} from './queries'
export type {
  CollectionDetail,
  CollectionInput,
  CollectionPerfume,
  CollectionSummary,
} from './types'
