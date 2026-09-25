import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { useShelfItemPick } from '../hooks/useShelfItemPick'

import { ShelfItemPickList, type ShelfItemCandidate } from './ShelfItemPickList'

const CANDIDATES: ShelfItemCandidate[] = [
  {
    shelfItemId: 1,
    perfumeId: 11,
    name: '우드 세이지 앤 씨 솔트',
    brand: '조 말론 런던',
  },
  { shelfItemId: 2, perfumeId: 12, name: '상탈 33', brand: '르 라보' },
  // 브랜드가 비어 있는 향수가 실제로 옵니다 — 이름만으로 걸려야 합니다
  { shelfItemId: 3, perfumeId: 13, name: '오르페옹', brand: null },
]

function Harness({
  candidates = CANDIDATES,
}: {
  candidates?: ShelfItemCandidate[]
}) {
  const { picked, toggle, keyword, setKeyword } = useShelfItemPick(true)

  return (
    <ShelfItemPickList
      candidates={candidates}
      picked={picked}
      onToggle={toggle}
      keyword={keyword}
      onKeywordChange={setKeyword}
      emptyTitle="진열대에 담은 향수가 없습니다"
    />
  )
}

const search = () => screen.getByRole('searchbox')

describe('ShelfItemPickList', () => {
  it('향수명으로 거른다', async () => {
    render(<Harness />)

    await userEvent.type(search(), '상탈')

    expect(screen.getByText('상탈 33')).toBeInTheDocument()
    expect(screen.queryByText('우드 세이지 앤 씨 솔트')).not.toBeInTheDocument()
  })

  it('브랜드명으로도 거르고, 브랜드가 없는 향수를 걸러도 죽지 않는다', async () => {
    render(<Harness />)

    await userEvent.type(search(), '조 말론')

    expect(screen.getByText('우드 세이지 앤 씨 솔트')).toBeInTheDocument()
    expect(screen.queryByText('오르페옹')).not.toBeInTheDocument()
  })

  it('고른 칸은 눌린 채로 알린다 — 다시 누르면 풀린다', async () => {
    render(<Harness />)

    const card = screen.getByRole('button', { name: /상탈 33/ })
    expect(card).toHaveAttribute('aria-pressed', 'false')

    await userEvent.click(card)
    expect(card).toHaveAttribute('aria-pressed', 'true')

    await userEvent.click(card)
    expect(card).toHaveAttribute('aria-pressed', 'false')
  })

  it('검색으로 가려져도 고른 것은 그대로 센다', async () => {
    render(<Harness />)

    await userEvent.click(
      screen.getByRole('button', { name: /우드 세이지 앤 씨 솔트/ }),
    )
    expect(screen.getByText(/1개 선택됨/)).toBeInTheDocument()

    await userEvent.type(search(), '상탈')

    expect(screen.queryByText('우드 세이지 앤 씨 솔트')).not.toBeInTheDocument()
    expect(screen.getByText(/1개 선택됨/)).toBeInTheDocument()
  })

  it('검색 결과가 없을 때와 담은 향수가 없을 때의 문구가 다르다', async () => {
    const { unmount } = render(<Harness />)

    await userEvent.type(search(), '없는향수')
    expect(screen.getByText('조건에 맞는 향수가 없습니다')).toBeInTheDocument()

    unmount()
    render(<Harness candidates={[]} />)

    expect(
      screen.getByText('진열대에 담은 향수가 없습니다'),
    ).toBeInTheDocument()
  })
})
