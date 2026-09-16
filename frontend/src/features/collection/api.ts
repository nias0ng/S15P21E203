import { http } from '@/shared/api/http'

import type {
  CollectionCreateInput,
  CollectionDetail,
  CollectionInput,
  CollectionPerfume,
  CollectionSummary,
} from './types'

/*
 * ── 백엔드 응답 모양 ─────────────────────────────────────────
 *
 * 화면 타입과 이름이 다른 칸이 있어(`name` → `title`) 응답을 그대로 흘려보내지 않고
 * 이 파일에서 옮깁니다. 향수 이름 · 브랜드는 **영문 원문**으로 옵니다(한국어 이름이
 * 응답에 없습니다) — 진열대 목록과 같습니다.
 */

/** GET /users/me/collections 의 한 줄 */
interface CollectionSummaryResponse {
  collectionId: number
  name: string
  description: string | null
  perfumeCount: number
  createdAt: string
  updatedAt: string
}

/** 최신 컬렉션이 먼저 옵니다(`ORDER BY id DESC`) */
interface CollectionsResponse {
  collections: CollectionSummaryResponse[]
  page: number
  size: number
  totalElements: number
}

interface CollectionPerfumeResponse {
  shelfItemId: number
  perfumeId: number
  name: string
  brand: string | null
  thumbnailUrl: string | null
}

/** GET /users/me/collections/{id} — 향수는 담은 순서대로 옵니다 */
interface CollectionDetailResponse {
  collectionId: number
  name: string
  description: string | null
  perfumes: CollectionPerfumeResponse[]
  createdAt: string
  updatedAt: string
}

/** POST /users/me/collections 응답 */
export interface CollectionCreateResponse {
  collectionId: number
  name: string
  description: string | null
  createdAt: string
}

/** 백엔드 `MAX_PAGE_SIZE`. 더 큰 값을 보내도 서버가 여기로 깎습니다 */
const MAX_PAGE_SIZE = 100

/** 카드 미리보기 칸 수 (와이어프레임 3장) */
const PREVIEW_SIZE = 3

/** 앞의 향수 사진 3장. 모자라면 null 로 채워 칸 수를 맞춥니다 */
function toPreview(perfumes: { thumbnailUrl: string | null }[]) {
  return Array.from(
    { length: PREVIEW_SIZE },
    (_, index) => perfumes[index]?.thumbnailUrl ?? null,
  )
}

function toPerfume(perfume: CollectionPerfumeResponse): CollectionPerfume {
  return {
    shelfItemId: perfume.shelfItemId,
    perfumeId: perfume.perfumeId,
    name: perfume.name,
    brand: perfume.brand,
    thumbnailUrl: perfume.thumbnailUrl,
  }
}

/**
 * 내 컬렉션 전부 (A13 하단).
 *
 * ⚠️ **목록 응답에 향수 사진이 없습니다** (이름 · 설명 · 향수 수뿐). 카드의 미리보기 3장을
 * 채우려고 컬렉션마다 상세를 한 번 더 부릅니다 — 컬렉션이 N 개면 요청이 최대 1 + N 개입니다.
 * 백엔드가 목록에 미리보기 사진을 실어 주면 상세 요청을 걷어내세요.
 *
 * - 향수가 0개인 컬렉션은 부르지 않습니다. 채울 사진이 없습니다
 * - 상세 하나가 실패해도 목록 전체를 실패로 만들지 않습니다 — 그 카드만 빈 칸으로 그립니다
 */
export async function getMyCollections(): Promise<CollectionSummary[]> {
  const summaries = await fetchAllSummaries()

  const details = await Promise.allSettled(
    summaries.map((summary) =>
      summary.perfumeCount > 0
        ? fetchDetail(summary.collectionId)
        : Promise.resolve(null),
    ),
  )

  return summaries.map((summary, index) => {
    const detail = details[index]
    const perfumes =
      detail?.status === 'fulfilled' && detail.value !== null
        ? detail.value.perfumes
        : []

    return {
      collectionId: summary.collectionId,
      title: summary.name,
      description: summary.description,
      perfumeCount: summary.perfumeCount,
      previewThumbnails: toPreview(perfumes),
    }
  })
}

/** 서버가 size 를 깎을 수 있으므로 **응답이 알려준 size** 로 남은 장수를 셉니다 */
async function fetchAllSummaries(): Promise<CollectionSummaryResponse[]> {
  const first = await fetchSummaryPage(0)
  const items = [...first.collections]

  const pageSize = first.size > 0 ? first.size : MAX_PAGE_SIZE
  const pages = Math.ceil(first.totalElements / pageSize)

  for (let page = 1; page < pages; page += 1) {
    const next = await fetchSummaryPage(page)
    items.push(...next.collections)
  }

  return items
}

async function fetchSummaryPage(page: number) {
  const { data } = await http.get<CollectionsResponse>(
    '/users/me/collections',
    { params: { page, size: MAX_PAGE_SIZE } },
  )
  return data
}

async function fetchDetail(collectionId: number) {
  const { data } = await http.get<CollectionDetailResponse>(
    `/users/me/collections/${collectionId}`,
  )
  return data
}

/**
 * 컬렉션 상세 (A17). 남의 컬렉션이거나 없으면 404 입니다.
 *
 * 향수 수는 목록의 `perfumeCount` 대신 **담긴 향수를 직접 셉니다** — 같은 값이지만
 * 한 응답 안에서 세면 목록 캐시와 어긋날 일이 없습니다.
 */
export async function getCollectionDetail(
  collectionId: number,
): Promise<CollectionDetail> {
  const data = await fetchDetail(collectionId)

  return {
    collectionId: data.collectionId,
    title: data.name,
    description: data.description,
    perfumeCount: data.perfumes.length,
    previewThumbnails: toPreview(data.perfumes),
    perfumes: data.perfumes.map(toPerfume),
  }
}

/*
 * ── 변경 (COL-01 · COL-03 ~ COL-06) ──────────────────────────
 *
 * 전부 로그인이 필요합니다. 서버의 규칙 둘이 화면에 드러납니다.
 *   - 이름은 사람마다 겹칠 수 없습니다 (409 `COLLECTION_NAME_ALREADY_EXISTS`)
 *   - **컬렉션은 늘 향수가 하나 이상입니다** — 만들 때 1개 이상, 마지막 향수는 빼기 불가
 */

/** 컬렉션 만들기 (COL-01). 진열대 향수를 하나 이상 함께 보내야 합니다 */
export async function createCollection(
  input: CollectionCreateInput,
): Promise<CollectionCreateResponse> {
  const { data } = await http.post<CollectionCreateResponse>(
    '/users/me/collections',
    {
      name: input.title,
      description: input.description,
      shelfItemIds: input.shelfItemIds,
    },
  )
  return data
}

/**
 * 제목 · 설명 수정 (COL-05).
 *
 * PATCH 라 **보낸 칸만** 바뀝니다. 설명을 `null` 로 보내면 지워지고, 칸을 빼면 그대로
 * 남습니다. 모달은 두 칸을 늘 함께 보내므로 설명을 비우고 저장하면 지워지는 것이 맞습니다.
 */
export async function updateCollection(
  collectionId: number,
  input: CollectionInput,
): Promise<void> {
  await http.patch(`/users/me/collections/${collectionId}`, {
    name: input.title,
    description: input.description,
  })
}

/** 컬렉션 삭제 (COL-06). 담긴 향수의 진열대 저장은 남습니다. 본문 없이 204 입니다 */
export async function deleteCollection(collectionId: number): Promise<void> {
  await http.delete(`/users/me/collections/${collectionId}`)
}

/**
 * 향수 하나 넣기 (COL-03). 컬렉션의 마지막 순서에 붙습니다.
 *
 * **한 번에 하나만 받습니다** — 여러 개는 부르는 쪽(`useCollectionActions`)이 차례로
 * 보냅니다. 이미 담긴 향수면 409 입니다.
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
 * 향수 빼기 (COL-04). 진열대 저장은 남습니다.
 *
 * ⚠️ **마지막 향수는 뺄 수 없습니다** (409 `COLLECTION_LAST_PERFUME`). 비우려면 컬렉션을
 * 지웁니다.
 */
export async function removeCollectionPerfume(
  collectionId: number,
  shelfItemId: number,
): Promise<void> {
  await http.delete(
    `/users/me/collections/${collectionId}/perfumes/${shelfItemId}`,
  )
}
