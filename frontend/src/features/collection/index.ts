/**
 * 컬렉션 도메인 공개 API (COL-01 ~ COL-08)
 *
 * 이 폴더 밖에서는 `@/features/collection` 만 import 합니다.
 * 화면: A13 하단 컬렉션 목록 / A17 컬렉션 상세 / A19 컬렉션 모달 3종
 *
 * 백엔드 컬렉션 API 7개가 전부 붙어 있습니다(api.ts). 전부 로그인이 필요합니다.
 */
export {
  addCollectionPerfume,
  createCollection,
  deleteCollection,
  removeCollectionPerfume,
  updateCollection,
} from './api'
export { AddToCollectionModal } from './components/AddToCollectionModal'
export { CollectionFormModal } from './components/CollectionFormModal'
export { CollectionStrip } from './components/CollectionStrip'
export {
  collectionDetailQuery,
  collectionKeys,
  collectionPreviewsQuery,
  myCollectionsQuery,
} from './queries'
export type { CollectionInput } from './types'
