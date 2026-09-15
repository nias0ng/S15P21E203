/**
 * 진열대 도메인 타입 (와이어프레임 A13 · A15 — SHF-01~14, DTL-18 · DTL-19)
 */

/**
 * 진열대 분류. A11 · A15 에서 저장할 때 필수입니다.
 *
 * 여기 적힌 라벨이 이 분류의 **유일한 이름**입니다. 저장 모달도 진열대 도구 줄도
 * 이 값을 끌어다 씁니다 — 화면마다 다른 낱말로 부르면 사용자가 "시향해 봄" 으로
 * 담은 향수를 "시향 기록" 에서 찾아야 합니다.
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

/**
 * 분류 칩에 붙는 개수. **검색어를 적용한 뒤**의 수입니다 —
 * 검색 중에는 칩 숫자가 "이 칸에 몇 개가 걸렸나" 를 알려주는 쪽이 쓸모 있습니다.
 *
 * Record 로 두면 분류가 늘 때 컴파일러가 빠진 칸을 잡아줍니다. 예전에는
 * `{ all, owned, tried, wish }` 라 분류와 칸 이름을 잇는 표를 따로 들고 있었고,
 * 그 표가 곧 어긋날 자리였습니다.
 */
export type ShelfCounts = Record<ShelfCategory, number>

/** 진열장 한 칸 — 분류 하나와 거기 선 향수들 */
export type ShelfSection = {
  category: ShelfCategory
  label: string
  items: ShelfItem[]
}

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
  /*
   * 영문 표기 셋. 사람이 읽는 대소문자 그대로 두고, 대문자는 CSS 가 입힙니다.
   *
   * ⚠️ 백엔드가 아직 주지 않습니다 — 지금은 자리표시자(api.ts)에만 채워 두었습니다. 필수로
   * 선언하면 타입은 통과하는데 런타임에 undefined 라 빈 줄이 생깁니다. 영문 브랜드가 없으면
   * 이름표가 그 자리에 한글 브랜드를 적습니다(DisplayCase).
   * 백엔드가 내려주기 시작하면 `?` 를 떼세요.
   */
  /** 영문 브랜드 (Jo Malone). 이름표 첫 줄에 자간을 넓힌 대문자로 적습니다 */
  brandEn?: string
  /** 영문 향수 이름 (Wood Sage & Sea Salt). 이름표를 간소화하면서 지금은 화면에 적지 않습니다 */
  nameEn?: string
  /** 부향률 (Eau de Cologne). 이름표를 간소화하면서 지금은 화면에 적지 않습니다 */
  concentration?: string
  thumbnailUrl: string | null
  category: ShelfCategory
  /** 대표 향수는 한 번에 하나. 보유 중 칸에만 표시됩니다 (A13 주석). */
  representative: boolean
  /**
   * 내 취향 적합도 (SHF-12 · DTL-18 · DTL-19). 선택 항목입니다.
   *
   * **1.0~5.0 을 0.5 단위**로 받습니다(백엔드 `@DecimalMin("1.0") @DecimalMax("5.0")`,
   * 컬럼은 `NUMERIC(2, 1)`). 0.5 는 받지 않아 고를 수 있는 값은 아홉 개입니다.
   */
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
