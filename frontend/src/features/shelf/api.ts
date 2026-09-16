import { http } from '@/shared/api/http'

import {
  SHELF_CATEGORIES,
  type ShelfCategory,
  type ShelfItem,
  type ShelfItemDetail,
} from './types'

/*
 * `src/assets/bottles/` 의 향수병 사진을 glob 으로 읽던 코드가 여기 있었습니다.
 * 자리표시자 향수에 손으로 짝지어 둔 것이라 실제 데이터에는 맞출 수 없어
 * 자리표시자와 함께 지웠습니다 — 파일 이름이 `브랜드_-_향수명` 인데 서버가 주는
 * 이름("Wood Sage & Sea Salt")과 폴더의 이름("Wood_Sage")이 다릅니다.
 *
 * 이제 병 사진은 서버의 `thumbnailUrl` 을 씁니다. 값이 없으면 DisplayCase 가
 * 병 실루엣을 그립니다.
 */

/**
 * 백엔드가 페이지에 담아 주는 목록 응답.
 *
 * `totalElements` 는 **그 분류의 전체 개수**입니다(검색어와 무관).
 */
interface ShelfItemsResponse {
  perfumes: ShelfItem[]
  page: number
  size: number
  totalElements: number
}

/** 백엔드 `MAX_PAGE_SIZE`. 더 큰 값을 보내도 서버가 여기로 깎습니다 */
const MAX_PAGE_SIZE = 100

/**
 * 내 진열대 전부 (SHF-02).
 *
 * **분류마다 한 번씩, 세 번 부릅니다.** 서버는 `category` 를 필수로 받아 한 분류씩만
 * 주는데, 진열대 화면은 세 칸을 한 벽에 이어 놓고 검색도 세 칸에 함께 겁니다.
 *
 * 서버 페이지네이션을 그대로 쓰지 않는 이유가 그 검색입니다 — **목록 API 에 검색어
 * 파라미터가 없습니다.** 페이지 단위로 받아 오면 지금 페이지 안에서만 걸러져,
 * 다른 쪽에 있는 결과가 조용히 사라집니다. 그래서 한 분류를 통째로 받아 두고
 * 거르는 일은 화면이 합니다(`useShelfBrowser`).
 *
 * 한 분류가 100개를 넘으면 뒷장을 이어 받습니다. 대부분 한 번으로 끝납니다.
 */
export async function getShelfItems(): Promise<ShelfItem[]> {
  const perCategory = await Promise.all(
    SHELF_CATEGORIES.map(({ value }) => fetchCategory(value)),
  )
  return perCategory.flat()
}

async function fetchCategory(category: ShelfCategory): Promise<ShelfItem[]> {
  const first = await fetchPage(category, 0)
  const items = [...first.perfumes]

  // 서버가 size 를 깎을 수 있으므로 **응답이 알려준 size** 로 남은 장수를 셉니다
  const pageSize = first.size > 0 ? first.size : MAX_PAGE_SIZE
  const pages = Math.ceil(first.totalElements / pageSize)

  for (let page = 1; page < pages; page += 1) {
    const next = await fetchPage(category, page)
    items.push(...next.perfumes)
  }

  return items
}

async function fetchPage(category: ShelfCategory, page: number) {
  const { data } = await http.get<ShelfItemsResponse>('/users/me/shelf-items', {
    params: { category, page, size: MAX_PAGE_SIZE },
  })
  return data
}

/**
 * 고른 한 병의 전부 (SHF-09). 적합도 · 메모 · 향조는 여기에만 있습니다.
 *
 * 목록이 준 값(이름 · 브랜드 · 사진)은 그대로 다시 오므로, 화면은 목록 값을 먼저
 * 그려 두고 이 응답이 오면 덮어씁니다 — 카드를 넘길 때마다 패널이 비지 않습니다.
 */
export async function getShelfItemDetail(
  shelfItemId: number,
): Promise<ShelfItemDetail> {
  const { data } = await http.get<ShelfItemDetail>(
    `/users/me/shelf-items/${shelfItemId}`,
  )
  return data
}

/*
 * ── 항목 하나짜리 변경 (SHF-03 · SHF-05 · SHF-12) ────────────
 *
 * 전부 로그인이 필요하고, 응답에 바꾼 값이 그대로 실려 옵니다. 화면이 스스로
 * 계산하지 않고 이 값을 쓰면 서버와 어긋날 일이 없습니다.
 *
 * ⚠️ 응답의 항목 id 이름이 엔드포인트마다 다릅니다 — 분류 변경은 `shelfItemId`,
 * 대표 지정과 적합도는 `userPerfumeId` 입니다. 같은 값이고 우리는 보낸 id 를
 * 이미 알고 있어서 쓰지 않지만, 응답을 그대로 믿고 꺼내 쓰면 undefined 가 됩니다.
 */

/** PATCH /users/me/shelf-items/{id}/ownership 응답 */
export interface OwnershipChangeResponse {
  shelfItemId: number
  ownershipStatus: ShelfCategory
  updatedAt: string
}

/** PATCH /users/me/shelf-items/{id}/representative 응답 */
export interface RepresentativeChangeResponse {
  userPerfumeId: number
  representative: boolean
  updatedAt: string
}

/** PUT /users/me/shelf-items/{id}/fit-rating 응답 */
export interface FitRatingResponse {
  userPerfumeId: number
  fitRating: number
  updatedAt: string
}

/**
 * 분류 변경 (SHF-03).
 *
 * **대표 향수를 보유 중 밖으로 옮기면 서버가 대표 지정을 함께 풉니다.** 그래서
 * 이 요청 뒤에는 목록을 다시 받아야 합니다 — 화면이 분류만 고쳐 두면 벽에
 * 대표 표시가 남습니다.
 */
export async function changeShelfCategory(
  shelfItemId: number,
  category: ShelfCategory,
): Promise<OwnershipChangeResponse> {
  const { data } = await http.patch<OwnershipChangeResponse>(
    `/users/me/shelf-items/${shelfItemId}/ownership`,
    { ownershipStatus: category },
  )
  return data
}

/**
 * 대표 향수 지정 · 해제 (SHF-05).
 *
 * 지정하면 서버가 **먼저 있던 대표를 풉니다.** 대표는 한 번에 하나입니다.
 * 보유 중이 아닌 향수를 대표로 지정하면 400 입니다.
 */
export async function setShelfRepresentative(
  shelfItemId: number,
  representative: boolean,
): Promise<RepresentativeChangeResponse> {
  const { data } = await http.patch<RepresentativeChangeResponse>(
    `/users/me/shelf-items/${shelfItemId}/representative`,
    { representative },
  )
  return data
}

/**
 * 취향 적합도 등록 · 수정 (SHF-12). 1.0~5.0 을 0.5 단위로 보냅니다.
 *
 * 등록과 수정이 같은 요청입니다(`PUT`) — 화면이 "처음인지" 를 알 필요가 없습니다.
 */
export async function setShelfFitRating(
  shelfItemId: number,
  rating: number,
): Promise<FitRatingResponse> {
  const { data } = await http.put<FitRatingResponse>(
    `/users/me/shelf-items/${shelfItemId}/fit-rating`,
    { fitRating: rating },
  )
  return data
}

/** 취향 적합도 지우기. 본문 없이 204 로 답합니다 */
export async function removeShelfFitRating(shelfItemId: number): Promise<void> {
  await http.delete(`/users/me/shelf-items/${shelfItemId}/fit-rating`)
}

/*
 * ── 등록 · 저장 해제 · 메모 (SHF-01 · SHF-04 · SHF-10) ───────
 */

/** POST /users/me/shelf-items 응답 */
export interface ShelfItemCreateResponse {
  shelfItemId: number
  perfumeId: number
  ownershipStatus: ShelfCategory
  createdAt: string
}

/**
 * 진열대에 향수 담기 (SHF-01).
 *
 * **분류만 함께 보냅니다.** 적합도 · 메모는 각자 다른 엔드포인트라 등록 화면이
 * 한 번에 받은 값이라도 요청이 나뉩니다 — `registerShelfItem` 을 쓰는 쪽(`useShelfActions`)이
 * 순서대로 보냅니다.
 *
 * 이미 담은 향수면 409 입니다.
 */
export async function createShelfItem(
  perfumeId: number,
  category: ShelfCategory,
): Promise<ShelfItemCreateResponse> {
  const { data } = await http.post<ShelfItemCreateResponse>(
    '/users/me/shelf-items',
    { perfumeId, ownershipStatus: category },
  )
  return data
}

/** 진열대에서 빼기 (SHF-04). 본문 없이 204 로 답합니다 */
export async function deleteShelfItem(shelfItemId: number): Promise<void> {
  await http.delete(`/users/me/shelf-items/${shelfItemId}`)
}

/**
 * 메모 작성 (SHF-10). **이미 메모가 있으면 409** 입니다.
 *
 * 작성과 수정이 다른 요청이라 부르는 쪽이 어느 쪽인지 알아야 합니다. 상세 응답의
 * `memo` 가 `null` 인지로 가릅니다 — 따로 `GET .../memo` 를 부를 필요는 없습니다.
 */
export async function createShelfMemo(
  shelfItemId: number,
  content: string,
): Promise<void> {
  await http.post(`/users/me/shelf-items/${shelfItemId}/memo`, { content })
}

/** 메모 수정. **메모가 없으면 404** 입니다 */
export async function updateShelfMemo(
  shelfItemId: number,
  content: string,
): Promise<void> {
  await http.patch(`/users/me/shelf-items/${shelfItemId}/memo`, { content })
}

/**
 * 메모 지우기.
 *
 * 빈 글을 저장하는 길이 없습니다 — 서버가 `@NotBlank` 로 막습니다. 그래서 화면에서
 * 메모를 비우는 것은 저장이 아니라 **삭제**입니다.
 */
export async function deleteShelfMemo(shelfItemId: number): Promise<void> {
  await http.delete(`/users/me/shelf-items/${shelfItemId}/memo`)
}
