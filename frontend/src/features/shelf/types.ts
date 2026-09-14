/**
 * 진열대 도메인 타입 (와이어프레임 A13 · A15 — SHF-01~14, DTL-18 · DTL-19)
 */

/**
 * 진열대 분류. A11 · A15 에서 저장할 때 필수입니다.
 *
 * 아래 `SHELF_CATEGORIES` 의 라벨이 이 분류의 **유일한 이름**입니다. 화면마다 다른
 * 낱말로 부르면 "시향해 봄" 으로 담은 향수를 "시향 기록" 에서 찾게 됩니다.
 *
 * 향수 상세(A10)의 저장 모달도 이 값을 쓰는데 features 끼리는 import 할 수 없어,
 * 분류를 소유한 진열대 도메인에 두고 저장 모달도 여기 둡니다.
 */
export type ShelfCategory = 'OWNED' | 'TRIED' | 'WISH'

export const SHELF_CATEGORIES = [
  { value: 'OWNED', label: '보유 중' },
  { value: 'TRIED', label: '시향해 봄' },
  { value: 'WISH', label: '보유 희망' },
] as const satisfies readonly { value: ShelfCategory; label: string }[]

/**
 * 분류 칩에 붙는 개수. **검색어를 적용한 뒤**의 수입니다 — 검색 중에는 칩 숫자가
 * "이 칸에 몇 개가 걸렸나" 를 알려주는 쪽이 쓸모 있습니다.
 *
 * Record 로 두면 분류가 늘 때 컴파일러가 빠진 칸을 잡아줍니다.
 */
export type ShelfCounts = Record<ShelfCategory, number>

/** 진열장에 한 번에 서는 병의 수. 벽감 높이와 병 폭이 이 수를 전제로 맞춰져 있습니다 */
export const SHELF_SLOT_COUNT = 7

/**
 * 좌우 화살표 한 번에 넘어가는 칸 수.
 *
 * 일곱 칸을 통째로 넘기지 않는 이유: 화면이 한 번에 전부 바뀌면 방금 본 병이
 * 어디로 갔는지 알 수 없습니다. 세 칸씩 밀면 네 병이 남아 있어 이어집니다.
 */
export const SHELF_PAGE_STEP = 3

/** 진열대에 담긴 향수 한 개 */
export interface ShelfItem {
  shelfItemId: number
  perfumeId: number
  name: string
  brand: string
  thumbnailUrl: string | null
  category: ShelfCategory
  /** 대표 향수는 한 번에 하나. 보유 중 칸에만 표시됩니다 (A13 주석). */
  representative: boolean
  /** 내 취향 적합도 1~5 (SHF-12 · DTL-18 · DTL-19). 선택 항목입니다. */
  rating: number | null
  /** 개인 메모. 선택 항목이고 향수당 하나입니다. */
  memo: string | null
  /** 메모를 마지막으로 쓴 날 (YYYY.MM.DD 표기용 ISO) */
  memoUpdatedAt: string | null
}

/**
 * 등록 모달(A15) 1단계에서 고를 수 있는 향수.
 *
 * 향수 도메인 타입을 그대로 받지 않고 진열대가 필요한 값만 정의합니다.
 * 화면(pages)에서 검색 결과를 이 모양으로 맞춰 넘겨주세요.
 */
export interface PerfumeOption {
  perfumeId: number
  name: string
  brand: string
  thumbnailUrl?: string | null
  /** 이미 진열대에 있으면 카드에 담김 표시가 붙고 선택할 수 없습니다 (A15 주석). */
  alreadyInShelf?: boolean
}

/** A15 2단계에서 제출하는 값 */
export interface ShelfRegisterInput {
  perfumeId: number
  category: ShelfCategory
  rating: number | null
  memo: string | null
}
