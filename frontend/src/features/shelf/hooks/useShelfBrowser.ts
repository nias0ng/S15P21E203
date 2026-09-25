import { useMemo, useState } from 'react'

import { keywordMatcher } from '@/shared/lib/keywordMatch'

import {
  SHELF_CATEGORIES,
  type ShelfCategory,
  type ShelfItem,
  type ShelfSection,
} from '../types'

type ShelfBrowser = {
  /** 세 칸 전부. 벽에 가로로 이어 붙습니다 */
  sections: ShelfSection[]
  keyword: string
  changeKeyword: (next: string) => void
  /** 진열대 창 가운데에 걸린 칸. 칩의 켜짐입니다 */
  viewCategory: ShelfCategory
  changeViewCategory: (next: ShelfCategory) => void
  selected: ShelfItem | null
  /** 1부터 시작하는 순번 — 세 칸을 벽 순서대로 이은 순서입니다. 비면 0 */
  index: number
  total: number
  select: (item: ShelfItem) => void
  /** 앞뒤로 한 병. 칸 경계를 넘어갑니다. 끝에서는 아무 일도 일어나지 않습니다 */
  move: (step: 1 | -1) => void
  /** 그 칸의 첫 향수를 고릅니다(칩을 눌렀을 때). 빈 칸이면 선택을 그대로 둡니다 */
  selectFirstOf: (category: ShelfCategory) => void
}

/**
 * 진열대 화면의 상태 — 무엇이 벽에 서 있고, 무엇을 고르고 있는가.
 *
 * 화면(pages)에서 훅으로 뺀 이유는 길이가 아니라 **셋이 한 덩어리**이기 때문입니다.
 * 검색어 · 선택 · 칩은 서로 규칙이 걸려 있습니다.
 *
 *   - 검색어가 바뀌면 고르고 있던 향수가 벽에서 사라질 수 있다
 *   - 선택을 그대로 두면 오른쪽 패널만 벽에 없는 향수를 보여준다
 *   - 그래서 검색어를 바꾸면 선택을 버리고 첫 향수로 돌아간다
 *   - 칩을 누르면 그 칸의 첫 향수를 고른다(벽을 옮기는 일은 ShelfWall 이 한다)
 *
 * 벽이 어디까지 흘렀는지(px · 칸)는 여기 없습니다. 매 프레임 바뀌는 값이라 상태로
 * 들면 병 스물다섯 개가 매번 다시 그려집니다 — ShelfWall 이 들고, 칩에 알려야 할
 * "창 가운데 칸" 만 viewCategory 로 올려 보냅니다.
 */
export function useShelfBrowser(items: ShelfItem[]): ShelfBrowser {
  const [keyword, setKeyword] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [viewCategory, setViewCategory] = useState<ShelfCategory>('OWNED')

  // 검색은 향수명과 브랜드명을 함께 봅니다. 세 칸 모두에 같은 검색어가 걸립니다 —
  // 한 칸에만 걸면 다른 칸에 있는 결과가 조용히 가려집니다.
  const sections = useMemo<ShelfSection[]>(() => {
    const matches = keywordMatcher(keyword)

    return SHELF_CATEGORIES.map(({ value, label }) => ({
      category: value,
      label,
      items: items.filter(
        (item) => item.category === value && matches(item.name, item.brand),
      ),
    }))
  }, [items, keyword])

  /** 벽에 선 순서 그대로 이은 목록. 하단 페이저가 이 순서로 넘깁니다 */
  const lined = useMemo(
    () => sections.flatMap((section) => section.items),
    [sections],
  )

  /*
   * 선택을 id 로 들고 순번은 매번 다시 찾습니다. 순번을 그대로 저장하면 검색어가
   * 바뀔 때 3번이 다른 향수를 가리키게 됩니다.
   *
   * 못 찾으면(검색에 걸러졌을 때) 첫 향수로 떨어집니다 — 오른쪽 패널이 비어 있으면
   * 화면 한쪽이 빈 채로 남습니다.
   */
  const at = lined.findIndex((item) => item.shelfItemId === selectedId)
  const current = at >= 0 ? at : 0

  return {
    sections,
    keyword,
    changeKeyword: (next) => {
      setKeyword(next)
      setSelectedId(null)
    },
    viewCategory,
    changeViewCategory: setViewCategory,
    selected: lined[current] ?? null,
    index: lined.length === 0 ? 0 : current + 1,
    total: lined.length,
    select: (item) => setSelectedId(item.shelfItemId),
    move: (step) => {
      const next = lined[current + step]
      if (next) setSelectedId(next.shelfItemId)
    },
    selectFirstOf: (category) => {
      const first = sections.find((section) => section.category === category)
        ?.items[0]
      if (first) setSelectedId(first.shelfItemId)
    },
  }
}
