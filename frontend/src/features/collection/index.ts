/**
 * 컬렉션 도메인 공개 API (COL-01 ~ COL-08). 화면은 A13 하단 목록 · A17 상세 ·
 * A19 모달 3종이고, 백엔드 API 7개가 전부 붙어 있습니다(전부 로그인 필요).
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
