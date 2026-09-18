/**
 * 목데이터 계정의 처음 상태 — 개발 서버를 켤 때마다 이 값으로 돌아갑니다.
 *
 * 진열대 30병(보유 중 · 시향해 봄 · 보유 희망 10병씩) · 컬렉션 6개 · 향해 일지 11줄.
 * 진열대 브랜치(`design/fe/S15P21E203-prototype-shelf-redesign`)의 자리표시자도 같은 향수 ·
 * 같은 메모로 맞춰 두었습니다 — 두 화면을 나란히 놓고 비교할 수 있게.
 *
 * perfumeId 는 `catalog.ts` 의 번호(fragrantica_id)입니다.
 */

import type { MockFamily } from './catalog.ts'

/** 로그인하면 이 사람이 됩니다. 이메일 · 비밀번호는 무엇을 넣어도 됩니다 */
export const MOCK_ACCOUNT = {
  userId: 1,
  email: 'tester@hyanghae.dev',
  nickname: '향해테스터',
} as const

export type MockShelfCategory = 'OWNED' | 'TRIED' | 'WISH'

export interface ShelfSeed {
  shelfItemId: number
  perfumeId: number
  category: MockShelfCategory
  representative: boolean
  /** 취향 적합도 1.0~5.0 (0.5 단위) */
  rating: number | null
  memo: string | null
  memoUpdatedAt: string | null
}

export const SHELF_SEED: readonly ShelfSeed[] = [
  {
    shelfItemId: 1,
    perfumeId: 74041,
    category: 'OWNED',
    representative: true,
    rating: 4.5,
    memo: '출근용으로 제일 자주 쓴다. 두 번 뿌리면 과하고 한 번이 딱 맞다.',
    memoUpdatedAt: '2026-09-02T21:10:00+09:00',
  },
  {
    shelfItemId: 2,
    perfumeId: 65738,
    category: 'OWNED',
    representative: false,
    rating: 5,
    memo: null,
    memoUpdatedAt: null,
  },
  {
    shelfItemId: 3,
    perfumeId: 12201,
    category: 'OWNED',
    representative: false,
    rating: 3.5,
    memo: '여름에만 손이 간다. 지속력이 짧아서 오후에 다시 뿌려야 한다.',
    memoUpdatedAt: '2026-08-28T13:40:00+09:00',
  },
  {
    shelfItemId: 4,
    perfumeId: 6686,
    category: 'OWNED',
    representative: false,
    rating: 4,
    memo: null,
    memoUpdatedAt: null,
  },
  {
    shelfItemId: 5,
    perfumeId: 20542,
    category: 'OWNED',
    representative: false,
    rating: 4.5,
    memo: '샤워하고 막 나온 것 같은 향. 주말 아침에 뿌린다.',
    memoUpdatedAt: '2026-09-06T09:15:00+09:00',
  },
  {
    shelfItemId: 6,
    perfumeId: 32134,
    category: 'OWNED',
    representative: false,
    rating: 4,
    memo: null,
    memoUpdatedAt: null,
  },
  {
    shelfItemId: 7,
    perfumeId: 611,
    category: 'OWNED',
    representative: false,
    rating: 3,
    memo: '선물 받은 것. 나한테는 조금 무겁다.',
    memoUpdatedAt: '2026-09-04T19:30:00+09:00',
  },
  {
    shelfItemId: 8,
    perfumeId: 12192,
    category: 'OWNED',
    representative: false,
    rating: 4.5,
    memo: null,
    memoUpdatedAt: null,
  },
  {
    shelfItemId: 9,
    perfumeId: 72040,
    category: 'OWNED',
    representative: false,
    rating: 5,
    memo: '무화과 잎 냄새. 비 온 뒤에 특히 좋다.',
    memoUpdatedAt: '2026-09-10T08:05:00+09:00',
  },
  {
    shelfItemId: 10,
    perfumeId: 3024,
    category: 'OWNED',
    representative: false,
    rating: 3.5,
    memo: null,
    memoUpdatedAt: null,
  },
  {
    shelfItemId: 11,
    perfumeId: 3575,
    category: 'TRIED',
    representative: false,
    rating: 4,
    memo: '백화점에서 시향. 첫 향은 좋은데 잔향이 기억나지 않는다.',
    memoUpdatedAt: '2026-09-08T17:20:00+09:00',
  },
  {
    shelfItemId: 12,
    perfumeId: 10314,
    category: 'TRIED',
    representative: false,
    rating: 3.5,
    memo: null,
    memoUpdatedAt: null,
  },
  {
    shelfItemId: 13,
    perfumeId: 18,
    category: 'TRIED',
    representative: false,
    rating: 4.5,
    memo: '초록 망고 같은 향. 다음에 사고 싶다.',
    memoUpdatedAt: '2026-09-11T14:00:00+09:00',
  },
  {
    shelfItemId: 14,
    perfumeId: 10131,
    category: 'TRIED',
    representative: false,
    rating: null,
    memo: null,
    memoUpdatedAt: null,
  },
  {
    shelfItemId: 15,
    perfumeId: 68905,
    category: 'TRIED',
    representative: false,
    rating: 3,
    memo: null,
    memoUpdatedAt: null,
  },
  {
    shelfItemId: 16,
    perfumeId: 27040,
    category: 'TRIED',
    representative: false,
    rating: 4,
    memo: '사막이라는 이름보다 훨씬 부드럽다.',
    memoUpdatedAt: '2026-09-12T20:45:00+09:00',
  },
  {
    shelfItemId: 17,
    perfumeId: 10464,
    category: 'TRIED',
    representative: false,
    rating: 2.5,
    memo: '장미가 너무 진하다. 겨울 저녁에나 어울릴 듯.',
    memoUpdatedAt: '2026-09-13T18:10:00+09:00',
  },
  {
    shelfItemId: 18,
    perfumeId: 70985,
    category: 'TRIED',
    representative: false,
    rating: 4.5,
    memo: null,
    memoUpdatedAt: null,
  },
  {
    shelfItemId: 19,
    perfumeId: 50790,
    category: 'TRIED',
    representative: false,
    rating: null,
    memo: null,
    memoUpdatedAt: null,
  },
  {
    shelfItemId: 20,
    perfumeId: 44894,
    category: 'TRIED',
    representative: false,
    rating: 3.5,
    memo: null,
    memoUpdatedAt: null,
  },
  {
    shelfItemId: 21,
    perfumeId: 131717,
    category: 'WISH',
    representative: false,
    rating: null,
    memo: '친구가 뿌린 향. 매장에서 한 번 맡아 보기.',
    memoUpdatedAt: '2026-09-14T12:30:00+09:00',
  },
  {
    shelfItemId: 22,
    perfumeId: 64167,
    category: 'WISH',
    representative: false,
    rating: null,
    memo: null,
    memoUpdatedAt: null,
  },
  {
    shelfItemId: 23,
    perfumeId: 6458,
    category: 'WISH',
    representative: false,
    rating: null,
    memo: null,
    memoUpdatedAt: null,
  },
  {
    shelfItemId: 24,
    perfumeId: 79437,
    category: 'WISH',
    representative: false,
    rating: null,
    memo: '여름 한정이라 빨리 사야 한다.',
    memoUpdatedAt: '2026-09-15T10:20:00+09:00',
  },
  {
    shelfItemId: 25,
    perfumeId: 73661,
    category: 'WISH',
    representative: false,
    rating: null,
    memo: null,
    memoUpdatedAt: null,
  },
  {
    shelfItemId: 26,
    perfumeId: 42782,
    category: 'WISH',
    representative: false,
    rating: null,
    memo: null,
    memoUpdatedAt: null,
  },
  {
    shelfItemId: 27,
    perfumeId: 47891,
    category: 'WISH',
    representative: false,
    rating: null,
    memo: null,
    memoUpdatedAt: null,
  },
  {
    shelfItemId: 28,
    perfumeId: 48434,
    category: 'WISH',
    representative: false,
    rating: null,
    memo: null,
    memoUpdatedAt: null,
  },
  {
    shelfItemId: 29,
    perfumeId: 56077,
    category: 'WISH',
    representative: false,
    rating: null,
    memo: null,
    memoUpdatedAt: null,
  },
  {
    shelfItemId: 30,
    perfumeId: 38914,
    category: 'WISH',
    representative: false,
    rating: null,
    memo: null,
    memoUpdatedAt: null,
  },
]

export interface CollectionSeed {
  collectionId: number
  name: string
  description: string | null
  /** 담은 순서대로 */
  shelfItemIds: number[]
  createdAt: string
}

export const COLLECTION_SEED: readonly CollectionSeed[] = [
  {
    collectionId: 1,
    name: '비 오는 날',
    description: '젖은 공기에 어울리는 차분한 향',
    shelfItemIds: [18, 9, 1, 14],
    createdAt: '2026-09-05T20:00:00+09:00',
  },
  {
    collectionId: 2,
    name: '출근용 데일리',
    description: '한 번 뿌리면 오후까지 무난한 향',
    shelfItemIds: [10, 4, 12, 7],
    createdAt: '2026-09-07T08:30:00+09:00',
  },
  {
    collectionId: 3,
    name: '겨울 우디',
    description: '니트에 스며드는 따뜻한 나무 향',
    shelfItemIds: [3, 22, 23, 28, 11],
    createdAt: '2026-09-09T22:15:00+09:00',
  },
  {
    collectionId: 4,
    name: '여름 바다',
    description: null,
    shelfItemIds: [8, 27, 24],
    createdAt: '2026-09-11T11:40:00+09:00',
  },
  {
    collectionId: 5,
    name: '잠들기 전',
    description: '포근한 머스크와 비누 향',
    shelfItemIds: [5, 19, 21],
    createdAt: '2026-09-13T23:05:00+09:00',
  },
  {
    collectionId: 6,
    name: '선물 후보',
    description: '처음 향수를 고르는 친구에게',
    shelfItemIds: [15, 20, 29, 30, 26],
    createdAt: '2026-09-15T16:50:00+09:00',
  },
]

export interface VoyageLogSeed {
  entryId: number
  enteredAt: string
  region: MockFamily
  /** 그 구역에서 들른 향수(perfumeId). 지나가기만 했으면 빈 목록 */
  visited: number[]
}

/**
 * 오래된 것부터 적습니다 (응답은 최근 것부터). 우디 → 시트러스 → 플로럴 → 아쿠아틱 → 머스크를
 * 돌고, 들른 향수는 그 해역 중심(`scent_families.csv` 의 anchor)에 가까운 사진 있는 향수입니다.
 */
export const VOYAGE_LOG_SEED: readonly VoyageLogSeed[] = [
  {
    entryId: 1,
    enteredAt: '2026-09-13T11:20:00+09:00',
    region: 'WOODY',
    visited: [46187, 12201],
  },
  {
    entryId: 2,
    enteredAt: '2026-09-13T16:05:00+09:00',
    region: 'CITRUS',
    visited: [75731],
  },
  {
    entryId: 3,
    enteredAt: '2026-09-13T22:30:00+09:00',
    region: 'FLORAL',
    visited: [44894, 8441, 17798],
  },
  {
    entryId: 4,
    enteredAt: '2026-09-14T10:40:00+09:00',
    region: 'AQUATIC',
    visited: [74041, 47891],
  },
  {
    entryId: 5,
    enteredAt: '2026-09-14T19:15:00+09:00',
    region: 'MUSK',
    visited: [131717],
  },
  {
    entryId: 6,
    enteredAt: '2026-09-14T23:50:00+09:00',
    region: 'WOODY',
    visited: [],
  },
  {
    entryId: 7,
    enteredAt: '2026-09-15T12:30:00+09:00',
    region: 'CITRUS',
    visited: [30567, 644],
  },
  {
    entryId: 8,
    enteredAt: '2026-09-15T21:05:00+09:00',
    region: 'FLORAL',
    visited: [75642],
  },
  {
    entryId: 9,
    enteredAt: '2026-09-16T13:25:00+09:00',
    region: 'AQUATIC',
    visited: [70985, 74636, 53671],
  },
  {
    entryId: 10,
    enteredAt: '2026-09-16T22:10:00+09:00',
    region: 'MUSK',
    visited: [50790, 6188],
  },
  {
    entryId: 11,
    enteredAt: '2026-09-17T08:40:00+09:00',
    region: 'WOODY',
    visited: [31247, 85144],
  },
]

/**
 * 향 계열 → `scent_regions.scent_region_id`. 백엔드 V5 마이그레이션이 넣은 순서입니다.
 * 화면은 코드(region)로 이름을 고르므로 번호는 응답 모양을 맞추는 데만 씁니다.
 */
export const SCENT_REGION_IDS: Record<MockFamily, number> = {
  FLORAL: 1,
  GREEN: 2,
  WOODY: 3,
  CITRUS: 4,
  AMBER: 5,
  MUSK: 6,
  GOURMAND: 7,
  FRUITY: 8,
  AQUATIC: 9,
}
