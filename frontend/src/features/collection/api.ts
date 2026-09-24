import { http } from '@/shared/api/http'

import type {
  CollectionDetail,
  CollectionInput,
  CollectionPerfume,
  CollectionSummary,
} from './types'

/** 서버는 `name`, 화면은 `title` 입니다 — 옮기는 일은 `toCollectionSummary` 한 곳입니다 */
interface CollectionBaseResponse {
  collectionId: number
  name: string
  description: string | null
  createdAt: string
  updatedAt: string
}

interface CollectionSummaryResponse extends CollectionBaseResponse {
  perfumeCount: number
  /** 담긴 순서대로 최대 3장. 사진이 없는 향수는 null, 빈 컬렉션은 빈 배열입니다 */
  previewThumbnails: (string | null)[]
}

interface CollectionsResponse {
  collections: CollectionSummaryResponse[]
  page: number
  size: number
  totalElements: number
}

/** 백엔드 `MAX_PAGE_SIZE`. 더 큰 값을 보내도 서버가 여기로 깎습니다 */
const MAX_PAGE_SIZE = 100

/** 지우는 데 쓰는 번호는 `shelfItemId` 입니다 */
interface CollectionPerfumeResponse {
  shelfItemId: number
  perfumeId: number
  name: string
  brand: string | null
  thumbnailUrl: string | null
}

/** 상세에는 개수 · 미리보기가 없습니다 — 담긴 향수에서 셉니다(`getCollectionDetail`) */
interface CollectionDetailResponse extends CollectionBaseResponse {
  perfumes: CollectionPerfumeResponse[]
}

/** 목록이 싣는 미리보기와 같은 장수입니다(백엔드 `PREVIEW_THUMBNAIL_COUNT`) */
const PREVIEW_COUNT = 3

function toCollectionSummary(
  collection: CollectionSummaryResponse,
): CollectionSummary {
  return {
    collectionId: collection.collectionId,
    title: collection.name,
    description: collection.description,
    perfumeCount: collection.perfumeCount,
    previewThumbnails: collection.previewThumbnails,
  }
}

function toCollectionPerfume(
  perfume: CollectionPerfumeResponse,
): CollectionPerfume {
  return {
    shelfItemId: perfume.shelfItemId,
    perfumeId: perfume.perfumeId,
    name: perfume.name,
    brand: perfume.brand,
    thumbnailUrl: perfume.thumbnailUrl,
  }
}

/** 페이지로 나뉘고 기본 10개라, 그냥 부르면 열한 번째부터 조용히 사라집니다 */
export async function getMyCollections(): Promise<CollectionSummary[]> {
  const first = await fetchCollectionPage(0)
  const collections = [...first.collections]

  // 서버가 size 를 깎을 수 있으므로 응답이 알려준 size 로 남은 장수를 셉니다
  const pageSize = first.size > 0 ? first.size : MAX_PAGE_SIZE
  const pages = Math.ceil(first.totalElements / pageSize)

  for (let page = 1; page < pages; page += 1) {
    const next = await fetchCollectionPage(page)
    collections.push(...next.collections)
  }

  return collections.map(toCollectionSummary)
}

async function fetchCollectionPage(page: number) {
  const { data } = await http.get<CollectionsResponse>(
    '/users/me/collections',
    {
      params: { page, size: MAX_PAGE_SIZE },
    },
  )
  return data
}

export async function getCollectionDetail(
  collectionId: number,
): Promise<CollectionDetail> {
  const { data } = await http.get<CollectionDetailResponse>(
    `/users/me/collections/${collectionId}`,
  )

  const perfumes = data.perfumes.map(toCollectionPerfume)

  return {
    collectionId: data.collectionId,
    title: data.name,
    description: data.description,
    perfumeCount: perfumes.length,
    previewThumbnails: perfumes
      .slice(0, PREVIEW_COUNT)
      .map((item) => item.thumbnailUrl),
    perfumes,
  }
}

/**
 * 이름은 사용자별로 중복될 수 없습니다(409). NOTE: 서버가 `shelfItemIds` 를 `@NotEmpty`
 * 로 요구해 빈 컬렉션을 만들 수 없습니다 — A19 의 "향수 없이도 생성 가능" 과 어긋납니다.
 */
export async function createCollection(
  input: CollectionInput,
  shelfItemIds: number[],
): Promise<number> {
  const { data } = await http.post<{ collectionId: number }>(
    '/users/me/collections',
    {
      name: input.title,
      description: input.description,
      shelfItemIds,
    },
  )
  return data.collectionId
}

/** 서버는 보낸 항목만 고칩니다. 이름은 비울 수 없고, 둘 다 생략하면 400 입니다 */
export async function updateCollection(
  collectionId: number,
  input: CollectionInput,
): Promise<void> {
  await http.patch(`/users/me/collections/${collectionId}`, {
    name: input.title,
    // 빈 설명은 "설명 없음" 입니다 — 서버가 공백을 삭제로 읽습니다
    description: input.description ?? '',
  })
}

/** 담긴 향수의 진열대 저장은 그대로 남습니다 */
export async function deleteCollection(collectionId: number): Promise<void> {
  await http.delete(`/users/me/collections/${collectionId}`)
}

/**
 * 컬렉션에는 내 진열대에 있는 향수만 들어갑니다. 서버가 한 번에 하나씩 받아 여러 개를
 * 고르면 그만큼 요청이 나가고, 이미 담긴 향수면 409 입니다.
 */
export async function addCollectionPerfume(
  collectionId: number,
  shelfItemId: number,
): Promise<void> {
  await http.post(`/users/me/collections/${collectionId}/perfumes`, {
    shelfItemId,
  })
}

/** 경로에 `perfumeId` 가 아니라 `shelfItemId` 가 들어갑니다. 진열대 저장은 그대로 남습니다 */
export async function removeCollectionPerfume(
  collectionId: number,
  shelfItemId: number,
): Promise<void> {
  await http.delete(
    `/users/me/collections/${collectionId}/perfumes/${shelfItemId}`,
  )
}
