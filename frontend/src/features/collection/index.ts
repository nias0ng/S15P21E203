/**
 * 컬렉션 도메인 공개 API (COL-01 ~ COL-08)
 *
 * 이 폴더 밖에서는 `@/features/collection` 만 import 합니다.
 * 화면: A13 하단 컬렉션 목록 / A17 컬렉션 상세 / A19 컬렉션 모달 3종
 *
 * 백엔드 `/users/me/collections` 에 붙어 있습니다 — 전부 로그인이 필요합니다.
 * 진열대 도메인을 import 할 수 없어, 고를 수 있는 향수는 화면이 진열대 데이터를
 * `CollectionCandidate` 로 옮겨 넘깁니다.
 */
export { AddToCollectionModal } from './components/AddToCollectionModal'
export { CollectionFormModal } from './components/CollectionFormModal'
export { CollectionStrip } from './components/CollectionStrip'
export {
  CollectionAddPartialError,
  useCollectionActions,
} from './hooks/useCollectionActions'
export {
  collectionDetailQuery,
  collectionKeys,
  myCollectionsQuery,
} from './queries'
export type {
  CollectionCandidate,
  CollectionCreateInput,
  CollectionDetail,
  CollectionInput,
  CollectionPerfume,
  CollectionSummary,
} from './types'
