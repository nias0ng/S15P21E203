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

/**
 * 컬렉션 카드에 얹을 미리보기 사진 (와이어프레임 A13 하단 — 카드마다 3장).
 *
 * ⚠️ **목록 응답에 썸네일이 없어 컬렉션마다 상세를 한 번씩 부릅니다.**
 * `CollectionSummaryResponse` 가 `collectionId · name · description ·
 * perfumeCount · createdAt · updatedAt` 뿐이라 사진을 만들 재료가 없습니다.
 *
 * 컬렉션이 다섯이면 요청이 다섯입니다. 그래도 쓰는 이유: 카드가 시안대로 향수
 * 사진을 보여줘야 하고, 상세 캐시를 그대로 재사용하므로 카드를 눌러 상세로 들어갈
 * 때는 요청이 다시 나가지 않습니다.
 *
 * **BE 가 목록에 `previewThumbnails` 를 실어 주면 이 훅을 지우세요.** 그때는
 * `api.ts` 의 `toCollectionSummary` 한 줄로 끝납니다.
 */
export const collectionPreviewsQuery = (collectionIds: number[]) =>
  collectionIds.map((collectionId) => collectionDetailQuery(collectionId))
