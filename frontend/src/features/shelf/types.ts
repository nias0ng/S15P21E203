/**
 * 진열대 도메인 타입 (와이어프레임 A13 · A15 — SHF-01~14, DTL-18 · DTL-19)
 */

/**
 * 진열대 분류. 와이어프레임 A13 주석대로 "칸이 세 개로 고정" 이고,
 * A11 · A15 에서 저장할 때 필수입니다.
 *
 * 이 어휘가 진열대 도메인에 있는 이유: 향수 상세(A10)의 저장 모달도 이 값을 쓰는데
 * features 끼리는 import 할 수 없으므로, 분류를 소유한 진열대 도메인에 두고
 * 저장 모달도 여기 둡니다. 향수 상세 화면은 pages 에서 두 도메인을 조합합니다.
 */
export type ShelfCategory = 'OWNED' | 'TRIED' | 'WISH'

export const SHELF_CATEGORIES = [
  { value: 'OWNED', label: '보유 중' },
  { value: 'TRIED', label: '시향해 봄' },
  { value: 'WISH', label: '보유 희망' },
] as const satisfies readonly { value: ShelfCategory; label: string }[]

/** A13 의 진열대 세 칸 제목 (분류명 그대로 씁니다) */
export const SHELF_SLOTS = [
  { category: 'OWNED', title: '진열대 1 · 보유 중' },
  { category: 'TRIED', title: '진열대 2 · 시향해 봄' },
  { category: 'WISH', title: '진열대 3 · 보유 희망' },
] as const satisfies readonly { category: ShelfCategory; title: string }[]

/**
 * 진열대에 담긴 향수 한 개.
 *
 * 메모는 향수 한 개당 하나입니다(와이어프레임 A15 주석 — 시향 기록 SHF-08 · SHF-10 이
 * 등록 모달로 흡수됐고, 향수 상세의 후기와는 별개입니다).
 */
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
 * 화면(pages)에서 향수 검색 결과를 이 모양으로 맞춰 넘겨주세요.
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
