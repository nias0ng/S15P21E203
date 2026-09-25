/**
 * 목데이터 API — 백엔드 없이 로그인 · 진열대 · 컬렉션 · 개인화 추천 · 향해 일지 · 향수 검색을 돌립니다.
 *
 * `npm run dev:mock` 이 켜는 개발 서버 미들웨어(`plugin.ts`)가 씁니다. **앱 코드는 목데이터를
 * 모릅니다** — 화면은 평소처럼 `/api/v1/...` 을 부르고, 여기 적힌 경로만 목데이터가 대신
 * 답합니다. 없는 경로는 원래대로 백엔드 프록시로 넘어갑니다.
 *
 * 응답 모양 · 상태 코드 · 오류 코드는 백엔드 컨트롤러와 DTO 를 옮겼습니다(2026-09-17 develop).
 * 화면에 드러나는 서버 규칙도 따라 합니다 — 대표 향수는 보유 중에서 하나, 컬렉션은 늘 향수가
 * 하나 이상, 이미 담은 향수는 409. 백엔드가 바뀌면 여기도 맞춥니다.
 *
 * 상태는 메모리에만 있습니다. 개발 서버를 다시 켜면 `seed.ts` 의 처음 상태로 돌아갑니다.
 */

import { MOCK_PERFUMES, type MockPerfume } from './catalog.ts'
import {
  COLLECTION_SEED,
  MOCK_ACCOUNT,
  SCENT_REGION_IDS,
  SHELF_SEED,
  VOYAGE_LOG_SEED,
  type MockShelfCategory,
} from './seed.ts'

const CDN = 'https://djpgc0m2v54q1.cloudfront.net/perfumes'

/** 서버의 일반 이미지(`ORIGINAL`). 향수 검색처럼 진열대 밖 화면이 씁니다 */
const originalImageUrl = (perfumeId: number) =>
  `${CDN}/${perfumeId}/original.png`

/**
 * 서버의 종이 질감 이미지(`PAPER_TEXTURE`).
 *
 * ⚠️ 투명 여백을 자르지 않은 1505×1360 캔버스입니다 — 병이 캔버스 폭의 23~41% 에 앉아 있어
 * 진열대에 세우면 병이 작게 서고 바닥에서 뜹니다. 그래서 로컬 사진이 없을 때만 씁니다(plugin.ts).
 */
export const paperTextureImageUrl = (perfumeId: number) =>
  `${CDN}/${perfumeId}/paper-texture.png`

interface MockApiOptions {
  /**
   * 진열대 · 컬렉션에 세울 병 사진 주소.
   * 서버가 이 두 화면에 종이 질감 이미지를 준다고 치고 고릅니다 — 지금 서버는 일반 이미지를 줍니다.
   */
  shelfImageUrl?: (perfume: MockPerfume) => string
  /** 지금 시각. 테스트가 고정합니다 */
  now?: () => Date
}

export interface MockRequest {
  query: URLSearchParams
  /** JSON 본문. 없으면 undefined */
  body: unknown
  /** `Authorization: Bearer …` 가 붙었는지. 토큰 값은 보지 않습니다 */
  loggedIn: boolean
}

export interface MockResponse {
  status: number
  /** 없으면 본문 없이 답합니다 */
  body?: unknown
}

type Handler = (request: MockRequest, params: number[]) => MockResponse

interface ShelfRecord {
  shelfItemId: number
  perfume: MockPerfume
  category: MockShelfCategory
  representative: boolean
  rating: number | null
  memo: string | null
  memoUpdatedAt: string | null
}

interface CollectionRecord {
  collectionId: number
  name: string
  description: string | null
  shelfItemIds: number[]
  createdAt: string
  updatedAt: string
}

/** 백엔드 `MAX_PAGE_SIZE` */
const MAX_PAGE_SIZE = 100

/** 향해 일지 기본 · 최대 줄 수 (ExplorationController) */
const VOYAGE_DEFAULT_SIZE = 20

const ACCESS_TOKEN = 'mock-access-token'

function fail(status: number, code: string, message: string): MockResponse {
  return { status, body: { code, message } }
}

const LOGIN_REQUIRED = fail(401, 'AUTH_LOGIN_REQUIRED', '로그인이 필요합니다.')
const SHELF_ITEM_NOT_FOUND = fail(
  404,
  'SHELF_ITEM_NOT_FOUND',
  '진열대 항목을 찾을 수 없습니다.',
)
const COLLECTION_NOT_FOUND = fail(
  404,
  'COLLECTION_NOT_FOUND',
  '컬렉션을 찾을 수 없습니다.',
)

function isCategory(value: unknown): value is MockShelfCategory {
  return value === 'OWNED' || value === 'TRIED' || value === 'WISH'
}

function hasField(body: unknown, key: string): boolean {
  return typeof body === 'object' && body !== null && key in body
}

/** 본문의 칸 하나. 본문이 객체가 아니면 undefined */
function field(body: unknown, key: string): unknown {
  return hasField(body, key)
    ? (body as Record<string, unknown>)[key]
    : undefined
}

/** 앞뒤 공백을 뗀 글. 글이 아니거나 비었으면 null */
function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null
}

/** 서버처럼 size 를 1~100 으로 깎아 한 장을 자릅니다 */
function paginate<T>(items: T[], query: URLSearchParams, defaultSize: number) {
  const page = Math.max(0, Math.trunc(Number(query.get('page'))) || 0)
  const requested = Math.trunc(Number(query.get('size'))) || defaultSize
  const size = Math.min(Math.max(requested, 1), MAX_PAGE_SIZE)

  return {
    content: items.slice(page * size, (page + 1) * size),
    page,
    size,
    totalElements: items.length,
  }
}

/** 공백 · 대소문자를 무시하고 비교합니다 ("woodsage" 로도 "Wood Sage" 가 걸립니다) */
const squash = (value: string) => value.replace(/\s+/g, '').toLowerCase()

export function createMockApi(options: MockApiOptions = {}) {
  const now = options.now ?? (() => new Date())
  const shelfImageUrl =
    options.shelfImageUrl ??
    ((perfume: MockPerfume) => paperTextureImageUrl(perfume.perfumeId))
  const timestamp = () => now().toISOString()

  const perfumes = new Map(
    MOCK_PERFUMES.map((perfume) => [perfume.perfumeId, perfume]),
  )
  const perfumeOf = (perfumeId: number): MockPerfume => {
    const perfume = perfumes.get(perfumeId)
    if (perfume === undefined) {
      throw new Error(`목데이터 catalog.ts 에 없는 향수입니다: ${perfumeId}`)
    }
    return perfume
  }

  const shelf: ShelfRecord[] = SHELF_SEED.map(({ perfumeId, ...seed }) => ({
    ...seed,
    perfume: perfumeOf(perfumeId),
  }))
  const collections: CollectionRecord[] = COLLECTION_SEED.map((seed) => ({
    ...seed,
    shelfItemIds: [...seed.shelfItemIds],
    updatedAt: seed.createdAt,
  }))
  const voyageLog = [...VOYAGE_LOG_SEED].reverse().map((seed) => ({
    entryId: seed.entryId,
    enteredAt: seed.enteredAt,
    scentRegionId: SCENT_REGION_IDS[seed.region],
    region: seed.region,
    visited: seed.visited.map((perfumeId) => ({
      perfumeId,
      name: perfumeOf(perfumeId).name,
    })),
  }))

  let nextShelfItemId =
    Math.max(...shelf.map((item) => item.shelfItemId), 0) + 1
  let nextCollectionId =
    Math.max(...collections.map((item) => item.collectionId), 0) + 1

  const findShelfItem = (shelfItemId: number | undefined) =>
    shelf.find((item) => item.shelfItemId === shelfItemId)
  const findCollection = (collectionId: number | undefined) =>
    collections.find((item) => item.collectionId === collectionId)

  /* ── 응답 모양 (백엔드 DTO) ─────────────────────────────── */

  const toShelfSummary = (item: ShelfRecord) => ({
    shelfItemId: item.shelfItemId,
    perfumeId: item.perfume.perfumeId,
    name: item.perfume.name,
    nameKo: item.perfume.nameKo,
    brand: item.perfume.brand,
    thumbnailUrl: shelfImageUrl(item.perfume),
    category: item.category,
    representative: item.representative,
  })

  const toShelfDetail = (item: ShelfRecord) => ({
    ...toShelfSummary(item),
    rating: item.rating,
    // 향조는 서버 seed 에 향수별 노트가 없어 비웁니다. 화면도 아직 그리지 않습니다
    scentNotes: [],
    memo: item.memo,
    memoUpdatedAt: item.memoUpdatedAt,
  })

  const toCollectionSummary = (collection: CollectionRecord) => ({
    collectionId: collection.collectionId,
    name: collection.name,
    description: collection.description,
    perfumeCount: collection.shelfItemIds.length,
    // 담긴 순서대로 앞의 세 장 — 사진이 없는 향수는 자리를 지키려고 null, 3개 미만이면 짧습니다
    previewThumbnails: collection.shelfItemIds
      .slice(0, 3)
      .map((shelfItemId) => findShelfItem(shelfItemId))
      .map((item) => (item === undefined ? null : shelfImageUrl(item.perfume))),
    createdAt: collection.createdAt,
    updatedAt: collection.updatedAt,
  })

  const toCollectionDetail = (collection: CollectionRecord) => ({
    collectionId: collection.collectionId,
    name: collection.name,
    description: collection.description,
    perfumes: collection.shelfItemIds
      .map((shelfItemId) => findShelfItem(shelfItemId))
      .filter((item): item is ShelfRecord => item !== undefined)
      .map((item) => ({
        shelfItemId: item.shelfItemId,
        perfumeId: item.perfume.perfumeId,
        name: item.perfume.name,
        brand: item.perfume.brand,
        thumbnailUrl: shelfImageUrl(item.perfume),
      })),
    createdAt: collection.createdAt,
    updatedAt: collection.updatedAt,
  })

  const toPerfumeSummary = (perfume: MockPerfume) => ({
    perfumeId: perfume.perfumeId,
    name: perfume.name,
    nameKo: perfume.nameKo,
    brandName: perfume.brand,
    brandNameKo: perfume.brandKo,
    imageUrl: originalImageUrl(perfume.perfumeId),
    scentFamily: perfume.family,
  })

  /* ── 인증 ──────────────────────────────────────────────── */

  const login: Handler = ({ body }) =>
    text(field(body, 'email')) === null ||
    text(field(body, 'password')) === null
      ? fail(400, 'INVALID_REQUEST', '이메일과 비밀번호를 입력해주세요.')
      : { status: 200, body: { accessToken: ACCESS_TOKEN } }

  const me: Handler = () => ({ status: 200, body: MOCK_ACCOUNT })

  /* ── 진열대 ────────────────────────────────────────────── */

  const listShelfItems: Handler = ({ query }) => {
    const category = query.get('category')
    if (!isCategory(category)) {
      return fail(
        400,
        'INVALID_REQUEST',
        'category 는 OWNED · TRIED · WISH 중 하나입니다.',
      )
    }

    // 서버는 담은 순서(user_perfume_id)대로 줍니다
    const items = shelf
      .filter((item) => item.category === category)
      .sort((a, b) => a.shelfItemId - b.shelfItemId)
    const { content, ...page } = paginate(items, query, 20)

    return {
      status: 200,
      body: { perfumes: content.map(toShelfSummary), ...page },
    }
  }

  const createShelfItem: Handler = ({ body }) => {
    const perfumeId = field(body, 'perfumeId')
    const category = field(body, 'ownershipStatus')
    if (typeof perfumeId !== 'number' || !isCategory(category)) {
      return fail(
        400,
        'INVALID_REQUEST',
        'perfumeId 와 ownershipStatus 를 보내주세요.',
      )
    }

    const perfume = perfumes.get(perfumeId)
    if (perfume === undefined) {
      return fail(
        404,
        'SHELF_PERFUME_NOT_FOUND',
        '저장할 향수를 찾을 수 없습니다.',
      )
    }
    if (shelf.some((item) => item.perfume.perfumeId === perfumeId)) {
      return fail(
        409,
        'SHELF_ITEM_ALREADY_EXISTS',
        '이미 진열대에 저장된 향수입니다.',
      )
    }

    const item: ShelfRecord = {
      shelfItemId: nextShelfItemId,
      perfume,
      category,
      representative: false,
      rating: null,
      memo: null,
      memoUpdatedAt: null,
    }
    nextShelfItemId += 1
    shelf.push(item)

    return {
      status: 201,
      body: {
        shelfItemId: item.shelfItemId,
        perfumeId,
        ownershipStatus: category,
        createdAt: timestamp(),
      },
    }
  }

  const getShelfItem: Handler = (_, [shelfItemId]) => {
    const item = findShelfItem(shelfItemId)
    return item === undefined
      ? SHELF_ITEM_NOT_FOUND
      : { status: 200, body: toShelfDetail(item) }
  }

  const deleteShelfItem: Handler = (_, [shelfItemId]) => {
    const item = findShelfItem(shelfItemId)
    if (item === undefined) return SHELF_ITEM_NOT_FOUND

    const lastInCollection = collections.some(
      (collection) =>
        collection.shelfItemIds.length === 1 &&
        collection.shelfItemIds[0] === shelfItemId,
    )
    if (lastInCollection) {
      return fail(
        409,
        'SHELF_LAST_COLLECTION_ITEM',
        '컬렉션의 마지막 향수입니다. 컬렉션을 먼저 삭제해주세요.',
      )
    }

    for (const collection of collections) {
      collection.shelfItemIds = collection.shelfItemIds.filter(
        (id) => id !== shelfItemId,
      )
    }
    shelf.splice(shelf.indexOf(item), 1)
    return { status: 204 }
  }

  const changeOwnership: Handler = ({ body }, [shelfItemId]) => {
    const item = findShelfItem(shelfItemId)
    if (item === undefined) return SHELF_ITEM_NOT_FOUND

    const category = field(body, 'ownershipStatus')
    if (!isCategory(category)) {
      return fail(
        400,
        'INVALID_REQUEST',
        'ownershipStatus 는 OWNED · TRIED · WISH 중 하나입니다.',
      )
    }

    item.category = category
    // 대표 향수를 보유 중 밖으로 옮기면 서버가 대표 지정을 함께 풉니다
    if (category !== 'OWNED') item.representative = false

    return {
      status: 200,
      body: {
        shelfItemId: item.shelfItemId,
        ownershipStatus: category,
        updatedAt: timestamp(),
      },
    }
  }

  const putFitRating: Handler = ({ body }, [shelfItemId]) => {
    const item = findShelfItem(shelfItemId)
    if (item === undefined) return SHELF_ITEM_NOT_FOUND

    const rating = field(body, 'fitRating')
    const valid =
      typeof rating === 'number' &&
      rating >= 1 &&
      rating <= 5 &&
      Number.isInteger(rating * 2)
    if (!valid) {
      return fail(
        400,
        'INVALID_REQUEST',
        '취향 적합도는 1.0~5.0 을 0.5 단위로 보냅니다.',
      )
    }

    item.rating = rating
    return {
      status: 200,
      body: {
        userPerfumeId: item.shelfItemId,
        fitRating: rating,
        updatedAt: timestamp(),
      },
    }
  }

  const deleteFitRating: Handler = (_, [shelfItemId]) => {
    const item = findShelfItem(shelfItemId)
    if (item === undefined) return SHELF_ITEM_NOT_FOUND

    item.rating = null
    return { status: 204 }
  }

  const createMemo: Handler = ({ body }, [shelfItemId]) => {
    const item = findShelfItem(shelfItemId)
    if (item === undefined) return SHELF_ITEM_NOT_FOUND

    const content = text(field(body, 'content'))
    if (content === null) {
      return fail(400, 'INVALID_REQUEST', '메모 내용을 입력해주세요.')
    }
    if (item.memo !== null) {
      return fail(409, 'SHELF_MEMO_ALREADY_EXISTS', '이미 메모가 존재합니다.')
    }

    item.memo = content
    item.memoUpdatedAt = timestamp()
    return { status: 201 }
  }

  const updateMemo: Handler = ({ body }, [shelfItemId]) => {
    const item = findShelfItem(shelfItemId)
    if (item === undefined) return SHELF_ITEM_NOT_FOUND
    if (item.memo === null) {
      return fail(404, 'SHELF_MEMO_NOT_FOUND', '메모를 찾을 수 없습니다.')
    }

    const content = text(field(body, 'content'))
    if (content === null) {
      return fail(400, 'INVALID_REQUEST', '메모 내용을 입력해주세요.')
    }

    item.memo = content
    item.memoUpdatedAt = timestamp()
    return { status: 200 }
  }

  const deleteMemo: Handler = (_, [shelfItemId]) => {
    const item = findShelfItem(shelfItemId)
    if (item === undefined) return SHELF_ITEM_NOT_FOUND
    if (item.memo === null) {
      return fail(404, 'SHELF_MEMO_NOT_FOUND', '메모를 찾을 수 없습니다.')
    }

    item.memo = null
    item.memoUpdatedAt = null
    return { status: 204 }
  }

  /* ── 컬렉션 ────────────────────────────────────────────── */

  const nameTaken = (name: string, except?: CollectionRecord) =>
    collections.some(
      (collection) => collection !== except && collection.name === name,
    )

  const listCollections: Handler = ({ query }) => {
    // 최신 컬렉션이 먼저 옵니다 (ORDER BY id DESC)
    const sorted = [...collections].sort(
      (a, b) => b.collectionId - a.collectionId,
    )
    const { content, ...page } = paginate(sorted, query, 20)

    return {
      status: 200,
      body: { collections: content.map(toCollectionSummary), ...page },
    }
  }

  const createCollection: Handler = ({ body }) => {
    const name = text(field(body, 'name'))
    const description = field(body, 'description')
    const shelfItemIds = field(body, 'shelfItemIds')

    if (
      name === null ||
      (description !== undefined &&
        description !== null &&
        typeof description !== 'string') ||
      !Array.isArray(shelfItemIds) ||
      shelfItemIds.length === 0
    ) {
      return fail(
        400,
        'COLLECTION_INVALID_REQUEST',
        '컬렉션 요청을 확인해주세요.',
      )
    }

    const ids = [...new Set(shelfItemIds)]
    if (!ids.every((id) => typeof id === 'number' && findShelfItem(id))) {
      return fail(
        404,
        'COLLECTION_SHELF_ITEM_NOT_FOUND',
        '내 진열대 항목을 찾을 수 없습니다.',
      )
    }
    if (nameTaken(name)) {
      return fail(
        409,
        'COLLECTION_NAME_ALREADY_EXISTS',
        '이미 사용 중인 컬렉션 이름입니다.',
      )
    }

    const createdAt = timestamp()
    const collection: CollectionRecord = {
      collectionId: nextCollectionId,
      name,
      description: text(description),
      shelfItemIds: ids as number[],
      createdAt,
      updatedAt: createdAt,
    }
    nextCollectionId += 1
    collections.push(collection)

    return {
      status: 201,
      body: {
        collectionId: collection.collectionId,
        name: collection.name,
        description: collection.description,
        createdAt,
      },
    }
  }

  const getCollection: Handler = (_, [collectionId]) => {
    const collection = findCollection(collectionId)
    return collection === undefined
      ? COLLECTION_NOT_FOUND
      : { status: 200, body: toCollectionDetail(collection) }
  }

  const updateCollection: Handler = ({ body }, [collectionId]) => {
    const collection = findCollection(collectionId)
    if (collection === undefined) return COLLECTION_NOT_FOUND

    // PATCH — 보낸 칸만 바꿉니다. 설명을 null 로 보내면 지웁니다
    if (hasField(body, 'name')) {
      const name = text(field(body, 'name'))
      if (name === null) {
        return fail(
          400,
          'COLLECTION_INVALID_REQUEST',
          '컬렉션 요청을 확인해주세요.',
        )
      }
      if (nameTaken(name, collection)) {
        return fail(
          409,
          'COLLECTION_NAME_ALREADY_EXISTS',
          '이미 사용 중인 컬렉션 이름입니다.',
        )
      }
      collection.name = name
    }
    if (hasField(body, 'description')) {
      collection.description = text(field(body, 'description'))
    }
    collection.updatedAt = timestamp()

    return {
      status: 200,
      body: {
        collectionId: collection.collectionId,
        name: collection.name,
        description: collection.description,
        updatedAt: collection.updatedAt,
      },
    }
  }

  const deleteCollection: Handler = (_, [collectionId]) => {
    const collection = findCollection(collectionId)
    if (collection === undefined) return COLLECTION_NOT_FOUND

    collections.splice(collections.indexOf(collection), 1)
    return { status: 204 }
  }

  const addCollectionPerfume: Handler = ({ body }, [collectionId]) => {
    const collection = findCollection(collectionId)
    if (collection === undefined) return COLLECTION_NOT_FOUND

    const shelfItemId = field(body, 'shelfItemId')
    if (typeof shelfItemId !== 'number' || !findShelfItem(shelfItemId)) {
      return fail(
        404,
        'COLLECTION_SHELF_ITEM_NOT_FOUND',
        '내 진열대 항목을 찾을 수 없습니다.',
      )
    }
    if (collection.shelfItemIds.includes(shelfItemId)) {
      return fail(
        409,
        'COLLECTION_PERFUME_ALREADY_EXISTS',
        '컬렉션에 이미 추가된 향수입니다.',
      )
    }

    // 마지막 순서에 붙습니다
    collection.shelfItemIds.push(shelfItemId)
    collection.updatedAt = timestamp()
    return { status: 201 }
  }

  const removeCollectionPerfume: Handler = (_, [collectionId, shelfItemId]) => {
    const collection = findCollection(collectionId)
    if (collection === undefined) return COLLECTION_NOT_FOUND

    if (
      shelfItemId === undefined ||
      !collection.shelfItemIds.includes(shelfItemId)
    ) {
      return fail(
        404,
        'COLLECTION_PERFUME_NOT_FOUND',
        '컬렉션에서 향수를 찾을 수 없습니다.',
      )
    }
    if (collection.shelfItemIds.length === 1) {
      return fail(
        409,
        'COLLECTION_LAST_PERFUME',
        '컬렉션의 마지막 향수는 제거할 수 없습니다.',
      )
    }

    collection.shelfItemIds = collection.shelfItemIds.filter(
      (id) => id !== shelfItemId,
    )
    collection.updatedAt = timestamp()
    return { status: 204 }
  }

  /* ── 개인화 추천 (S15P21E203-419) ──────────────────────── */

  /*
   * 서버는 사용자마다 점수 높은 후보 열 병을 모아 두고, 부를 때마다 그중 하나를 뽑아 **새 손잡이**와
   * 함께 줍니다. 화면이 "보였다" 고 알린 병(노출)은 사흘 동안 뽑기에서 빠집니다. 목데이터는 점수 대신
   * 한국 선정 순위로 열 병을 세우고, 사흘 대신 개발 서버가 켜져 있는 동안 뺍니다.
   * 보유 중인 향수만 후보에서 빠집니다(시향 · 희망은 추천될 수 있습니다) — 서버와 같습니다.
   *
   * 손잡이는 서버에서 UUID 인데 여기서는 숫자입니다. 경로표가 숫자만 받기 때문이고, 화면은 손잡이를
   * 읽지 않고 돌려보내기만 해서 달라도 됩니다.
   */
  const PERSONAL_CANDIDATES = 10
  let nextOfferToken = 1001
  const offers = new Map<number, number>()
  /** 노출을 남긴 향수와 그 순서(오래된 것부터 다시 나옵니다) */
  const exposed = new Map<number, number>()
  let exposures = 0

  /** 계열의 한국어 이름 — 취향 테스트 틀에 넣습니다(서버는 향 계열 표의 한국어 이름을 씁니다) */
  const FAMILY_KO: Record<MockPerfume['family'], string> = {
    CITRUS: '시트러스',
    FRUITY: '프루티',
    FLORAL: '플로럴',
    GREEN: '그린',
    AQUATIC: '아쿠아틱',
    WOODY: '우디',
    AMBER: '앰버',
    GOURMAND: '구르망',
    MUSK: '머스크',
  }
  /** 계열에 맞는 향 특성(영어) — 적합도 · 최근 본 향수 틀은 서버도 영어로 넣습니다 */
  const FAMILY_ACCORD: Record<MockPerfume['family'], string> = {
    CITRUS: 'citrus',
    FRUITY: 'fruity',
    FLORAL: 'floral',
    GREEN: 'green',
    AQUATIC: 'aquatic',
    WOODY: 'woody',
    AMBER: 'amber',
    GOURMAND: 'sweet',
    MUSK: 'musky',
  }

  /** 서버의 근거 문장 세 틀(PersonalizedRecommendationService.reasonOf) — 뽑힌 차례대로 돌려 씁니다 */
  const personalReason = (perfume: MockPerfume, turn: number) => {
    const accord = FAMILY_ACCORD[perfume.family]
    switch (turn % 3) {
      case 0:
        return `취향 테스트에서 선택한 ${FAMILY_KO[perfume.family]} 계열과 잘 맞아요.`
      case 1:
        return `높게 평가한 향수와 ${accord} 어코드가 비슷해요.`
      default:
        return `최근 살펴본 향수에서 자주 만난 ${accord} 어코드를 담고 있어요.`
    }
  }

  const getPersonalRecommendation: Handler = () => {
    const owned = new Set(
      shelf
        .filter((item) => item.category === 'OWNED')
        .map((item) => item.perfume.perfumeId),
    )
    const candidates = MOCK_PERFUMES.filter(
      (perfume) => !owned.has(perfume.perfumeId),
    ).slice(0, PERSONAL_CANDIDATES)
    if (candidates.length === 0) {
      return fail(404, 'RECOMMENDATION_NOT_FOUND', '추천할 향수가 없습니다.')
    }

    const fresh = candidates.filter(
      (perfume) => !exposed.has(perfume.perfumeId),
    )
    // 다 봤으면 가장 오래전에 본 것부터 다시 — 서버와 같습니다
    const picked =
      fresh[Math.floor(Math.random() * fresh.length)] ??
      [...candidates].sort(
        (a, b) =>
          (exposed.get(a.perfumeId) ?? 0) - (exposed.get(b.perfumeId) ?? 0),
      )[0]
    if (picked === undefined) {
      return fail(404, 'RECOMMENDATION_NOT_FOUND', '추천할 향수가 없습니다.')
    }

    const token = nextOfferToken
    nextOfferToken += 1
    offers.set(token, picked.perfumeId)
    return {
      status: 200,
      body: {
        recommendationToken: String(token),
        recommendation: {
          perfumeId: picked.perfumeId,
          name: picked.nameKo ?? picked.name,
          imageUrl: originalImageUrl(picked.perfumeId),
          reason: personalReason(picked, token),
        },
      },
    }
  }

  /** 노출 기록 — 같은 손잡이로 또 와도 204 이고 두 번 세지 않습니다. 모르는 손잡이는 404 */
  const recordPersonalExposure: Handler = (_request, [token]) => {
    const perfumeId = token === undefined ? undefined : offers.get(token)
    if (perfumeId === undefined) {
      return fail(
        404,
        'RECOMMENDATION_EXPOSURE_NOT_FOUND',
        '추천 노출 정보를 찾을 수 없습니다.',
      )
    }
    if (!exposed.has(perfumeId)) {
      exposures += 1
      exposed.set(perfumeId, exposures)
    }
    return { status: 204 }
  }

  /* ── 향해 일지 · 향수 검색 ─────────────────────────────── */

  const getVoyageLog: Handler = ({ query }) => {
    // 기본 20줄, 1~100 으로 깎습니다
    const requested =
      Math.trunc(Number(query.get('size'))) || VOYAGE_DEFAULT_SIZE
    const size = Math.min(Math.max(requested, 1), MAX_PAGE_SIZE)
    return { status: 200, body: { entries: voyageLog.slice(0, size) } }
  }

  /**
   * 배를 옮깁니다 (PUT /map/exploration/me). 엔진이 해역을 옮길 때마다 부릅니다.
   *
   * ⚠ **로그인 없이도 움직입니다** — 백엔드와 같은 규칙입니다(ExplorationController). 그때는
   * `updatedAt` 을 비워 "남기지 않았다" 를 알립니다. 401 이 아닙니다.
   * ⚠ 목데이터는 일지를 **새로 쌓지 않습니다** — seed 의 줄이 그대로입니다. 여기서 줄을 만들려면
   * 향 영역 폴리곤(엔진 terrain-data)이 있어야 하는데 목데이터는 그 좌표계를 모릅니다.
   */
  const moveExploration: Handler = ({ body, loggedIn }) => {
    const move = (body ?? {}) as {
      perfumeId?: number | null
      x?: number
      y?: number
    }
    const perfume =
      move.perfumeId == null ? undefined : perfumes.get(move.perfumeId)
    // 향수를 골랐으면 서버가 그 향수의 지도 좌표로 채웁니다 — 목데이터엔 지도 좌표가 없어 보낸 값을 씁니다
    const x = move.x ?? null
    const y = move.y ?? null
    if (move.perfumeId != null && perfume === undefined) {
      return fail(404, 'MAP_PERFUME_NOT_FOUND', '지도에 없는 향수입니다.')
    }
    // 향수 번호도 좌표도 없으면 어디로 갔는지 모릅니다
    if (move.perfumeId == null && (x === null || y === null)) {
      return fail(
        400,
        'MAP_MOVE_TARGET_REQUIRED',
        '향수 번호나 좌표가 필요합니다.',
      )
    }
    return {
      status: 200,
      body: { x, y, updatedAt: loggedIn ? timestamp() : null },
    }
  }

  const searchPerfumes: Handler = ({ query }) => {
    const keyword = squash(query.get('keyword') ?? '')
    const gender = query.get('gender')?.toLowerCase()

    // 검색어 · 성별만 봅니다. 순위 · 정렬 조건은 받지 않고 한국 선정 순위대로 줍니다
    const found = MOCK_PERFUMES.filter(
      (perfume) =>
        (keyword === '' ||
          [perfume.name, perfume.brand, perfume.nameKo, perfume.brandKo].some(
            (value) => value !== null && squash(value).includes(keyword),
          )) &&
        (gender === undefined || perfume.gender === gender),
    )
    const { content, ...page } = paginate(found, query, 20)

    return {
      status: 200,
      body: { perfumes: content.map(toPerfumeSummary), ...page },
    }
  }

  /* ── 경로표 ────────────────────────────────────────────── */

  /** 로그인해야 부를 수 있는 경로. 비로그인은 401 입니다 */
  const signedIn =
    (handler: Handler): Handler =>
    (request, params) =>
      request.loggedIn ? handler(request, params) : LOGIN_REQUIRED

  const SHELF = '/users/me/shelf-items'
  const COLLECTIONS = '/users/me/collections'

  const routes: [method: string, path: RegExp, handler: Handler][] = [
    ['POST', /^\/auth\/login$/, login],
    [
      'POST',
      /^\/auth\/refresh$/,
      () => ({ status: 200, body: { accessToken: ACCESS_TOKEN } }),
    ],
    ['POST', /^\/auth\/logout$/, () => ({ status: 204 })],
    ['GET', /^\/users\/me$/, signedIn(me)],

    ['GET', new RegExp(`^${SHELF}$`), signedIn(listShelfItems)],
    ['POST', new RegExp(`^${SHELF}$`), signedIn(createShelfItem)],
    ['GET', new RegExp(`^${SHELF}/(\\d+)$`), signedIn(getShelfItem)],
    ['DELETE', new RegExp(`^${SHELF}/(\\d+)$`), signedIn(deleteShelfItem)],
    [
      'PATCH',
      new RegExp(`^${SHELF}/(\\d+)/ownership$`),
      signedIn(changeOwnership),
    ],
    ['PUT', new RegExp(`^${SHELF}/(\\d+)/fit-rating$`), signedIn(putFitRating)],
    [
      'DELETE',
      new RegExp(`^${SHELF}/(\\d+)/fit-rating$`),
      signedIn(deleteFitRating),
    ],
    ['POST', new RegExp(`^${SHELF}/(\\d+)/memo$`), signedIn(createMemo)],
    ['PATCH', new RegExp(`^${SHELF}/(\\d+)/memo$`), signedIn(updateMemo)],
    ['DELETE', new RegExp(`^${SHELF}/(\\d+)/memo$`), signedIn(deleteMemo)],

    ['GET', new RegExp(`^${COLLECTIONS}$`), signedIn(listCollections)],
    ['POST', new RegExp(`^${COLLECTIONS}$`), signedIn(createCollection)],
    ['GET', new RegExp(`^${COLLECTIONS}/(\\d+)$`), signedIn(getCollection)],
    [
      'PATCH',
      new RegExp(`^${COLLECTIONS}/(\\d+)$`),
      signedIn(updateCollection),
    ],
    [
      'DELETE',
      new RegExp(`^${COLLECTIONS}/(\\d+)$`),
      signedIn(deleteCollection),
    ],
    [
      'POST',
      new RegExp(`^${COLLECTIONS}/(\\d+)/perfumes$`),
      signedIn(addCollectionPerfume),
    ],
    [
      'DELETE',
      new RegExp(`^${COLLECTIONS}/(\\d+)/perfumes/(\\d+)$`),
      signedIn(removeCollectionPerfume),
    ],

    [
      'GET',
      /^\/recommendations\/personalized$/,
      signedIn(getPersonalRecommendation),
    ],
    [
      'POST',
      /^\/recommendations\/personalized\/(\d+)\/exposure$/,
      signedIn(recordPersonalExposure),
    ],

    ['GET', /^\/map\/exploration-logs$/, signedIn(getVoyageLog)],
    // ⚠ signedIn 을 씌우지 않습니다 — 비회원도 배를 움직입니다 (위 주석)
    ['PUT', /^\/map\/exploration\/me$/, moveExploration],
    ['GET', /^\/perfumes$/, searchPerfumes],
  ]

  return {
    /**
     * 이 요청을 목데이터가 받는지. 받으면 처리 함수를, 아니면 null 을 돌려줍니다.
     * `path` 는 `/api/v1` 을 뗀 경로입니다 (`/users/me/shelf-items`).
     *
     * 브랜드 번호로 거르는 향수 검색은 백엔드로 넘깁니다 — 목데이터 향수는 DB 브랜드 번호를
     * 모르고, 브랜드 상세가 넘기는 번호는 백엔드의 것입니다.
     */
    find(
      method: string,
      path: string,
      query: URLSearchParams = new URLSearchParams(),
    ): ((request: MockRequest) => MockResponse) | null {
      if (path === '/perfumes' && query.has('brandId')) return null
      for (const [routeMethod, pattern, handler] of routes) {
        if (routeMethod !== method.toUpperCase()) continue

        const match = pattern.exec(path)
        if (match !== null) {
          const params = match.slice(1).map(Number)
          return (request) => handler(request, params)
        }
      }
      return null
    },
  }
}
