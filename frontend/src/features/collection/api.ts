import { http } from '@/shared/api/http'

import type {
  CollectionDetail,
  CollectionInput,
  CollectionPerfume,
  CollectionSummary,
} from './types'

/**
 * 컬렉션 한 줄 (`GET /users/me/collections`).
 *
 * **이름이 `name` 입니다** — 화면은 `title` 로 부릅니다. 어긋나는 자리가 여기
 * 하나라, 옮기는 일은 아래 `toCollectionSummary` 한 곳에서만 합니다.
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
}

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
 * ⚠️ 목록 응답에 썸네일이 없어(`CollectionSummaryResponse` 참고) 빈 자리로 채웁니다.
 * `[]` 로 두면 `slice(0, 3)` 이 빈 배열이라 상자가 하나도 안 그려지고, 카드가
 * 납작해져 옆의 [+ 컬렉션 만들기] 점선 카드와 높이가 어긋납니다.
 * BE 가 `previewThumbnails` 를 내려주면 이 줄만 고칩니다.
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
 * 진열대와 달리 페이지가 없습니다 — 서버가 `collections` 배열 하나로 줍니다.
 */
export async function getMyCollections(): Promise<CollectionSummary[]> {
  const { data } = await http.get<CollectionsResponse>('/users/me/collections')
  return data.collections.map(toCollectionSummary)
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
     * ⚠️ **상세 응답에는 `perfumeCount` 가 없습니다**(`CollectionDetailResponse` 는
     * `collectionId · name · description · perfumes · createdAt · updatedAt` 뿐).
     * 목록 응답에만 있어서 그대로 옮기면 `undefined` 가 되고 화면에 "향수 개" 로
     * 찍힙니다. 담긴 향수를 세는 것이 서버가 세는 것과 같은 값입니다.
     */
    perfumeCount: perfumes.length,
    /*
     * 상세는 담긴 향수를 다 주므로 앞 세 장을 미리보기로 씁니다.
     * **모자라면 빈 자리로 채웁니다** — 두 장만 그리면 카드 안에서 사진이 넓게
     * 늘어나(각 `flex-1`) 컬렉션마다 사진 크기가 달라집니다.
     */
    previewThumbnails: [
      ...perfumes.slice(0, 3).map((item) => item.thumbnailUrl),
      ...EMPTY_PREVIEW,
    ].slice(0, 3),
    perfumes,
  }
}

/*
 * ── 컬렉션 만들기 · 수정 · 삭제 (COL-01 · COL-05 · COL-06) ───
 *
 * 전부 로그인이 필요합니다. 진열대와 달리 **부분 실패가 없습니다** — 한 동작이
 * 요청 하나로 끝납니다(향수를 담고 빼는 것은 별도 엔드포인트입니다).
 */

/**
 * 컬렉션 만들기 (COL-01).
 *
 * ⚠️ **빈 컬렉션을 만들 수 없습니다.** 서버가 `shelfItemIds` 를 `@NotEmpty` 로
 * 요구해서 만들 때 진열대 항목을 최소 하나 넣어야 합니다. 와이어프레임 A19 주석은
 * "향수 없이도 생성 가능" 이라 어긋나는데, 서버 쪽을 바꿀 수 없어 **만들기 모달에서
 * 향수를 고르게** 했습니다(`CollectionFormModal`). BE 가 그 제약을 풀면 모달의
 * 고르는 목록을 선택으로 되돌리고 여기에 빈 배열을 넘기면 됩니다.
 *
 * 이름은 사용자별로 중복될 수 없습니다(409).
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
 * 서버가 **보낸 항목만** 고칩니다(`namePresent` · `descriptionPresent`). 생략하면
 * 그대로 두고, 설명을 빈 값으로 보내면 지웁니다. 이름은 비울 수 없고, 둘 다
 * 생략하면 400 입니다 — 모달이 늘 둘 다 들고 있어 그대로 보냅니다.
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
 * 컬렉션에 향수 담기 (COL-03).
 *
 * **진열대 항목 번호를 보냅니다** — 컬렉션에는 내 진열대에 있는 향수만 들어갑니다.
 * 서버가 한 번에 하나씩 받아서, 여러 개를 고르면 그만큼 요청이 나갑니다.
 *
 * 이미 담긴 향수면 409 입니다 — 화면이 후보에서 미리 걸러 냅니다.
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
