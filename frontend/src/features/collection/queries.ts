import { queryOptions } from '@tanstack/react-query'

import { getCollectionDetail, getMyCollections } from './api'

export const collectionKeys = {
  all: ['collections'] as const,
  mine: () => [...collectionKeys.all, 'mine'] as const,
  details: () => [...collectionKeys.all, 'detail'] as const,
  detail: (collectionId: number) =>
    [...collectionKeys.details(), collectionId] as const,
}

export const myCollectionsQuery = () =>
  queryOptions({
    queryKey: collectionKeys.mine(),
    queryFn: getMyCollections,
  })

export const collectionDetailQuery = (collectionId: number) =>
  queryOptions({
    queryKey: collectionKeys.detail(collectionId),
    queryFn: () => getCollectionDetail(collectionId),
  })

/** NOTE: 목록 응답에 썸네일이 없어 컬렉션마다 상세를 한 번씩 부릅니다 */
export const collectionPreviewsQuery = (collectionIds: number[]) =>
  collectionIds.map((collectionId) => collectionDetailQuery(collectionId))
