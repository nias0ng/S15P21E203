import { useMemo, useState } from 'react'

import {
  SHELF_CATEGORIES,
  SHELF_PAGE_STEP,
  SHELF_SLOT_COUNT,
  type ShelfCategory,
  type ShelfCounts,
  type ShelfItem,
} from '../types'

/** 진열장 한 칸 — 분류 하나와 거기 선 향수들 */
export type ShelfSection = {
  category: ShelfCategory
  label: string
  items: ShelfItem[]
}

type ShelfBrowser = {
  /** 지금 보고 있는 칸 */
  category: ShelfCategory
  /** 0부터 시작하는 칸 순서. 미끄러지는 애니메이션이 이 값으로 움직입니다 */
  categoryIndex: number
  changeCategory: (next: ShelfCategory) => void
  /** 순서로 칸을 바꿉니다. 휠로 넘길 때 씁니다 */
  changeCategoryIndex: (next: number) => void
  /** 세 칸 전부. 미끄러지는 동안 옆 칸도 보여야 해서 전부 넘깁니다 */
  sections: ShelfSection[]
  keyword: string
  changeKeyword: (next: string) => void
  /** 검색어를 적용한 뒤의 칸별 개수 */
  counts: ShelfCounts
  /** 지금 칸에 선 향수 */
  visible: ShelfItem[]
  selected: ShelfItem | null
  /** 1부터 시작하는 순번. 칸이 비면 0 */
  index: number
  total: number
  select: (item: ShelfItem) => void
  /** 앞뒤로 한 칸. 끝에서는 아무 일도 일어나지 않습니다 */
  move: (step: 1 | -1) => void
  /** 지금 진열장에 보이는 첫 병의 순서 */
  windowStart: number
  /** 좌우 화살표. 세 칸씩 밉니다 */
  pageWindow: (direction: 1 | -1) => void
  canPagePrev: boolean
  canPageNext: boolean
}

/**
 * 진열대 화면의 상태 — 어느 칸을 보고 있고, 그 칸의 어디를 보고 있는가.
 *
 * 화면(pages)에서 훅으로 뺀 이유는 길이가 아니라 **넷이 한 덩어리**이기 때문입니다.
 * 칸 · 검색어 · 선택 · 진열장 창은 서로 규칙이 걸려 있습니다.
 *
 *   - 칸이나 검색어가 바뀌면 고르고 있던 향수가 목록에서 사라진다
 *   - 선택을 그대로 두면 오른쪽 패널만 목록에 없는 향수를 보여준다
 *   - 그래서 칸을 옮기면 선택을 버리고 진열장도 맨 앞으로 되돌린다
 *   - 반대로 하단 페이저로 선택이 창 밖으로 나가면 창이 선택을 따라간다
 *
 * 이 규칙이 화면에 흩어져 있으면 칸을 바꾸는 자리를 새로 만드는 사람이 초기화를
 * 빠뜨립니다. 규칙과 상태를 같이 두면 빠뜨릴 수가 없습니다.
 */
export function useShelfBrowser(items: ShelfItem[]): ShelfBrowser {
  const [category, setCategory] = useState<ShelfCategory>('OWNED')
  const [keyword, setKeyword] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [windowStart, setWindowStart] = useState(0)

  // 검색은 향수명과 브랜드명을 함께 봅니다. 세 칸 모두에 같은 검색어가 걸립니다 —
  // 지금 칸에만 걸면 다른 칸에 있는 결과가 조용히 가려집니다.
  const sections = useMemo<ShelfSection[]>(() => {
    const needle = keyword.trim().toLowerCase()
    const matches = (item: ShelfItem) =>
      !needle ||
      item.name.toLowerCase().includes(needle) ||
      item.brand.toLowerCase().includes(needle)

    return SHELF_CATEGORIES.map(({ value, label }) => ({
      category: value,
      label,
      items: items.filter((item) => item.category === value && matches(item)),
    }))
  }, [items, keyword])

  const counts = useMemo(
    () =>
      Object.fromEntries(
        sections.map((section) => [section.category, section.items.length]),
      ) as ShelfCounts,
    [sections],
  )

  const found = sections.findIndex((section) => section.category === category)
  const categoryIndex = found >= 0 ? found : 0
  const visible = sections[categoryIndex]?.items ?? []

  /*
   * 선택을 id 로 들고 순번은 매번 다시 찾습니다. 순번을 그대로 저장하면 칸을 바꿀
   * 때 3번이 다른 향수를 가리키게 됩니다.
   *
   * 못 찾으면(칸을 막 옮겼거나 검색에 걸러졌을 때) 첫 향수로 떨어집니다 —
   * 오른쪽 패널이 비어 있으면 화면 절반이 빈 채로 남습니다.
   */
  const at = visible.findIndex((item) => item.shelfItemId === selectedId)
  const current = at >= 0 ? at : 0

  // 목록이 줄어 창이 끝을 넘어가면 끌어당깁니다. 안 그러면 빈 진열장이 보입니다.
  const maxStart = Math.max(0, visible.length - SHELF_SLOT_COUNT)
  const start = Math.min(windowStart, maxStart)

  /** 고른 병이 창 밖이면 창을 최소한만 움직여 안으로 들입니다 */
  const keepInView = (target: number) =>
    setWindowStart((from) => {
      if (target < from) return target
      if (target >= from + SHELF_SLOT_COUNT)
        return target - SHELF_SLOT_COUNT + 1
      return from
    })

  const goToCategory = (next: ShelfCategory) => {
    setCategory(next)
    setSelectedId(null)
    setWindowStart(0)
  }

  return {
    category,
    categoryIndex,
    changeCategory: goToCategory,
    changeCategoryIndex: (next) => {
      const section = sections[next]
      if (section) goToCategory(section.category)
    },
    sections,
    keyword,
    changeKeyword: (next) => {
      setKeyword(next)
      setSelectedId(null)
      setWindowStart(0)
    },
    counts,
    visible,
    selected: visible[current] ?? null,
    index: visible.length === 0 ? 0 : current + 1,
    total: visible.length,
    select: (item) => setSelectedId(item.shelfItemId),
    move: (step) => {
      const target = current + step
      const next = visible[target]
      if (!next) return
      setSelectedId(next.shelfItemId)
      keepInView(target)
    },
    windowStart: start,
    pageWindow: (direction) =>
      setWindowStart(
        Math.min(Math.max(start + direction * SHELF_PAGE_STEP, 0), maxStart),
      ),
    canPagePrev: start > 0,
    canPageNext: start < maxStart,
  }
}
