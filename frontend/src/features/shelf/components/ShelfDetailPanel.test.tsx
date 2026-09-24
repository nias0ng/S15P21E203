import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

import type { ShelfItemDetail } from '../types'

import { ShelfDetailPanel } from './ShelfDetailPanel'

const WOOD_SAGE: ShelfItemDetail = {
  shelfItemId: 1,
  perfumeId: 1,
  /* 백엔드는 `name` 에 영문, `nameKo` 에 국문을 줍니다 */
  name: 'Wood Sage & Sea Salt',
  nameKo: '우드 세이지 앤 씨 솔트',
  brand: '조말론',
  brandEn: 'Jo Malone',
  concentration: 'Eau de Cologne',
  thumbnailUrl: null,
  category: 'OWNED',
  scentNotes: [],
  rating: 4,
  memo: '출근용으로 제일 자주 쓴다.',
  memoUpdatedAt: '2026-08-20T00:00:00Z',
}

/** 넘기지 않은 콜백은 vi.fn() 으로 채웁니다 — 검사할 것만 넘기면 됩니다 */
function renderPanel(
  item: ShelfItemDetail | null,
  props: Partial<Parameters<typeof ShelfDetailPanel>[0]> = {},
) {
  /* 이름이 링크라 라우터 안에서 그려야 합니다 */
  return render(
    <MemoryRouter>
      <ShelfDetailPanel
        item={item}
        onChangeRating={vi.fn()}
        onEdit={vi.fn()}
        onRemove={vi.fn()}
        {...props}
      />
    </MemoryRouter>,
  )
}

describe('ShelfDetailPanel 취향 적합도', () => {
  it('원의 반쪽을 누르면 0.5 단위로 올라간다', async () => {
    const onChangeRating = vi.fn()
    renderPanel(WOOD_SAGE, { onChangeRating })

    await userEvent.click(screen.getByRole('radio', { name: '5점 중 3.5점' }))
    expect(onChangeRating).toHaveBeenCalledWith(3.5)
  })

  it('아직 안 매긴 향수도 매길 수 있다', async () => {
    const onChangeRating = vi.fn()
    renderPanel({ ...WOOD_SAGE, rating: null }, { onChangeRating })

    await userEvent.click(screen.getByRole('radio', { name: '5점 중 1점' }))
    expect(onChangeRating).toHaveBeenCalledWith(1)
  })
})

describe('ShelfDetailPanel 메모', () => {
  it('적어둔 메모와 쓴 날짜를 보여준다', () => {
    renderPanel(WOOD_SAGE)

    expect(screen.getByText('출근용으로 제일 자주 쓴다.')).toBeInTheDocument()
  })

  it('메모가 없으면 무엇을 적는 칸인지 알려준다', () => {
    renderPanel({ ...WOOD_SAGE, memo: null, memoUpdatedAt: null })

    expect(
      screen.getByText('이 향을 어디서 언제 맡았는지 적어두세요.'),
    ).toBeInTheDocument()
  })

  it('카드에서는 고칠 수 없다 — 고치는 곳은 [변경하기] 한 곳입니다', () => {
    renderPanel(WOOD_SAGE)

    expect(
      screen.queryByRole('button', { name: '수정' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: '추가' }),
    ).not.toBeInTheDocument()
    expect(screen.queryByLabelText('개인 메모')).not.toBeInTheDocument()
  })
})

describe('ShelfDetailPanel 이름', () => {
  it('국문 이름을 크게 적고 영문 이름을 아래 줄에 단다', () => {
    renderPanel(WOOD_SAGE)

    expect(screen.getByText('우드 세이지 앤 씨 솔트')).toBeInTheDocument()
    expect(screen.getByText('Wood Sage & Sea Salt')).toBeInTheDocument()
  })

  it('국문 이름이 없는 향수는 영문만 한 번 적고 빈 줄을 두지 않는다', () => {
    renderPanel({ ...WOOD_SAGE, nameKo: null })

    expect(screen.getAllByText('Wood Sage & Sea Salt')).toHaveLength(1)
  })

  it('영문 브랜드가 없으면 국문 브랜드를 한 번만 적는다', () => {
    renderPanel({ ...WOOD_SAGE, brandEn: undefined })

    expect(screen.getAllByText('조말론')).toHaveLength(1)
  })
})

describe('ShelfDetailPanel 머리', () => {
  it('병이 선 분류를 머리에 적는다 — 영문은 장식이라 낭독기에는 한글 분류가 읽힌다', () => {
    renderPanel(WOOD_SAGE)

    expect(screen.getByText('My collection')).toHaveAttribute(
      'aria-hidden',
      'true',
    )
    expect(screen.getByText('보유 중')).toBeInTheDocument()
  })
})

describe('ShelfDetailPanel 향조', () => {
  const NOTES: ShelfItemDetail['scentNotes'] = [
    { noteId: 1, name: 'Sea Salt', noteType: 'top' },
    { noteId: 2, name: 'Ambrette', noteType: 'middle' },
    { noteId: 3, name: 'Sage', noteType: 'middle' },
    { noteId: 4, name: 'Driftwood', noteType: 'base' },
    { noteId: 5, name: 'Musk', noteType: 'base' },
    { noteId: 6, name: 'Amber', noteType: 'base' },
    { noteId: 7, name: 'Moss', noteType: 'base' },
  ]

  it('상세의 실제 노트를 탑 · 미들 · 베이스 줄로 적고, 넘치면 "외 N" 으로 줄인다', () => {
    renderPanel({ ...WOOD_SAGE, scentNotes: NOTES })

    expect(screen.getByText('Sea Salt')).toBeInTheDocument()
    expect(screen.getByText('Ambrette · Sage')).toBeInTheDocument()
    // 넷째부터는 "외 N" — 전부는 줄에 마우스를 올리면 보입니다
    expect(screen.getByTitle('Driftwood, Musk, Amber, Moss')).toHaveTextContent(
      'Driftwood · Musk · Amber 외 1',
    )
  })

  it('향조가 없는 향수는 없다고 적는다', () => {
    renderPanel(WOOD_SAGE)

    expect(
      screen.getByText('향조 정보가 아직 등록되지 않았어요'),
    ).toBeInTheDocument()
  })

  it('상세가 오는 중이면 향조 · 메모를 "없어요" 로 적지 않고 비워 둔다', () => {
    renderPanel(
      { ...WOOD_SAGE, memo: null, memoUpdatedAt: null },
      { pending: true },
    )

    expect(
      screen.queryByText('향조 정보가 아직 등록되지 않았어요'),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText('이 향을 어디서 언제 맡았는지 적어두세요.'),
    ).not.toBeInTheDocument()
  })
})

describe('ShelfDetailPanel 선택 전', () => {
  it('고른 향수가 없으면 안내만 적고 조작을 보여주지 않는다', () => {
    renderPanel(null)

    expect(
      screen.getByText('진열대에서 향수를 선택하면 여기에 정보가 표시됩니다'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})

describe('ShelfDetailPanel 향수 이름 링크', () => {
  it('이름을 누르면 향수 상세로 간다', () => {
    renderPanel(WOOD_SAGE)

    /*
      영문 줄은 낭독기에서 빼 두어(aria-hidden) 링크 이름이 국문으로 잡힙니다.
      이름 없는 링크가 되지 않는지 함께 보는 검사입니다.
    */
    const link = screen.getByRole('link', { name: '우드 세이지 앤 씨 솔트' })
    expect(link).toHaveAttribute('href', '/perfumes/1')
  })

  it('국문 이름이 없는 향수도 링크 이름이 남는다', () => {
    renderPanel({ ...WOOD_SAGE, nameKo: null })

    expect(
      screen.getByRole('link', { name: 'Wood Sage & Sea Salt' }),
    ).toHaveAttribute('href', '/perfumes/1')
  })
})
