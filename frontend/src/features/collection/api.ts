import { http } from '@/shared/api/http'

import type {
  CollectionDetail,
  CollectionInput,
  CollectionPerfume,
  CollectionSummary,
} from './types'

/**
 * 컬렉션 한 줄 (`GET /users/me/collections`). **이름이 `name` 입니다** — 화면은
 * `title` 이라, 옮기는 일은 아래 `toCollectionSummary` 한 곳에서만 합니다.
 */
interface CollectionSummaryResponse {
  collectionId: number
  name: string
  description: string | null
  perfumeCount: number
  createdAt: string
  updatedAt: string
}

interface CollectionsResponse {
  collections: CollectionSummaryResponse[]
  page: number
  size: number
  totalElements: number
}

/** 백엔드 `MAX_PAGE_SIZE`. 더 큰 값을 보내도 서버가 여기로 깎습니다 */
const MAX_PAGE_SIZE = 100

/** 컬렉션에 담긴 향수 한 건. 지우는 데 쓰는 번호는 `shelfItemId` 입니다 */
interface CollectionPerfumeResponse {
  shelfItemId: number
  perfumeId: number
  name: string
  brand: string | null
  thumbnailUrl: string | null
}

interface CollectionDetailResponse extends CollectionSummaryResponse {
  perfumes: CollectionPerfumeResponse[]
}

/**
 * 카드 미리보기 자리 세 개.
 *
 * ⚠️ 목록 응답에 썸네일이 없어 빈 자리로 채웁니다. `[]` 로 두면 상자가 하나도 안
 * 그려져 카드가 납작해집니다. BE 가 `previewThumbnails` 를 주면 이 줄만 고칩니다.
 */
const EMPTY_PREVIEW: (string | null)[] = [null, null, null]

function toCollectionSummary(
  collection: CollectionSummaryResponse,
): CollectionSummary {
  return {
    collectionId: collection.collectionId,
    title: collection.name,
    description: collection.description,
    perfumeCount: collection.perfumeCount,
    previewThumbnails: EMPTY_PREVIEW,
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

/**
 * 내 컬렉션 목록 (COL-01). 로그인이 필요합니다.
 *
 * **페이지로 나뉘고 기본 10개**라 그냥 부르면 열한 번째부터 조용히 사라집니다 —
 * 전부 보여주는 자리라 끝까지 받아옵니다(대부분 100개 한 번으로 끝납니다).
 */
export async function getMyCollections(): Promise<CollectionSummary[]> {
  const first = await fetchCollectionPage(0)
  const collections = [...first.collections]

  // 서버가 size 를 깎을 수 있으므로 **응답이 알려준 size** 로 남은 장수를 셉니다
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

/** 컬렉션 상세 (A17 · COL-02). 담긴 향수가 함께 옵니다 */
export async function getCollectionDetail(
  collectionId: number,
): Promise<CollectionDetail> {
  const { data } = await http.get<CollectionDetailResponse>(
    `/users/me/collections/${collectionId}`,
  )

  const perfumes = data.perfumes.map(toCollectionPerfume)

  return {
    ...toCollectionSummary(data),
    /*
     * ⚠️ **상세 응답에는 `perfumeCount` 가 없습니다**(목록 응답에만 있습니다).
     * 그대로 옮기면 `undefined` 라 화면에 "향수 개" 로 찍힙니다.
     */
    perfumeCount: perfumes.length,
    /* 앞 세 장을 미리보기로 쓰고, **모자라면 빈 자리로 채웁니다** */
    previewThumbnails: [
      ...perfumes.slice(0, 3).map((item) => item.thumbnailUrl),
      ...EMPTY_PREVIEW,
    ].slice(0, 3),
    perfumes,
  }
}

/*
 * ── 컬렉션 만들기 · 수정 · 삭제 (COL-01 · COL-05 · COL-06) ───
 * 전부 로그인이 필요하고, 진열대와 달리 **부분 실패가 없습니다** — 한 동작이 요청
 * 하나로 끝납니다(향수를 담고 빼는 것은 별도 엔드포인트입니다).
 */

/**
 * 컬렉션 만들기 (COL-01). 이름은 사용자별로 중복될 수 없습니다(409).
 *
 * ⚠️ **빈 컬렉션을 만들 수 없습니다** — 서버가 `shelfItemIds` 를 `@NotEmpty` 로
 * 요구합니다. 와이어프레임 A19 는 "향수 없이도 생성 가능" 이라 어긋나지만, 서버를
 * 바꿀 수 없어 **만들기 모달에서 향수를 고르게** 했습니다(`CollectionFormModal`).
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

/**
 * 컬렉션 수정 (COL-05). 제목 · 설명만 바꿉니다 — 구성 향수는 A17 에서 고칩니다.
 *
 * 서버가 **보낸 항목만** 고칩니다. 설명을 빈 값으로 보내면 지우고, 이름은 비울 수
 * 없으며, 둘 다 생략하면 400 입니다.
 */
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

/** 컬렉션 삭제 (COL-06). 담긴 향수의 진열대 저장은 그대로 남습니다. 204 */
export async function deleteCollection(collectionId: number): Promise<void> {
  await http.delete(`/users/me/collections/${collectionId}`)
}

/**
 * 컬렉션에 향수 담기 (COL-03). **진열대 항목 번호를 보냅니다** — 컬렉션에는 내
 * 진열대에 있는 향수만 들어갑니다. 서버가 한 번에 하나씩 받아 여러 개를 고르면
 * 그만큼 요청이 나가고, 이미 담긴 향수면 409 입니다.
 */
export async function addCollectionPerfume(
  collectionId: number,
  shelfItemId: number,
): Promise<void> {
  await http.post(`/users/me/collections/${collectionId}/perfumes`, {
    shelfItemId,
  })
}

/**
 * 컬렉션에서 향수 빼기 (COL-04). 진열대 저장은 그대로 남습니다. 204
 *
 * 경로에 `perfumeId` 가 아니라 **`shelfItemId`** 가 들어갑니다.
 */
export async function removeCollectionPerfume(
  collectionId: number,
  shelfItemId: number,
): Promise<void> {
  await http.delete(
    `/users/me/collections/${collectionId}/perfumes/${shelfItemId}`,
  )
}
