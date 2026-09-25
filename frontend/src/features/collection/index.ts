/** 컬렉션 도메인 공개 API (COL-01 ~ COL-08). 전부 로그인이 필요합니다 */

/*
 * 진열함 격자(CollectionStrip)의 모양. 진열대 도메인처럼 입구인 여기서 싣습니다 — 컴포넌트 안에
 * 두면 그 컴포넌트를 지우는 사람이 스타일시트까지 조용히 떨어뜨립니다.
 */
import './collection-cabinet.css'

export {
  addCollectionPerfume,
  createCollection,
  deleteCollection,
  removeCollectionPerfume,
  updateCollection,
} from './api'
export { AddToCollectionModal } from './components/AddToCollectionModal'
export { CollectionFormModal } from './components/CollectionFormModal'
export { CollectionNotice } from './components/CollectionNotice'
export { CollectionPerfumeGrid } from './components/CollectionPerfumeGrid'
export { CollectionStrip } from './components/CollectionStrip'
export {
  collectionDetailQuery,
  collectionKeys,
  myCollectionsQuery,
} from './queries'
export type { CollectionInput, CollectionPerfume } from './types'
