import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { ShelfItemDetail } from '../types'

import { ShelfDetailPanel } from './ShelfDetailPanel'

const WOOD_SAGE: ShelfItemDetail = {
  shelfItemId: 1,
  perfumeId: 1,
  name: '조 말론 우드 세이지 앤 씨 솔트',
  brand: '조말론',
  brandEn: 'Jo Malone',
  nameEn: 'Wood Sage & Sea Salt',
  concentration: 'Eau de Cologne',
  thumbnailUrl: null,
  category: 'OWNED',
  representative: false,
  nameKo: null,
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
  return render(
    <ShelfDetailPanel
      item={item}
      onSetRepresentative={vi.fn()}
      onChangeRating={vi.fn()}
      onEdit={vi.fn()}
      onRemove={vi.fn()}
      {...props}
    />,
  )
}

describe('ShelfDetailPanel 대표 향수 별', () => {
  it('보유 중이고 아직 대표가 아니면 누를 수 있다', async () => {
    const onSetRepresentative = vi.fn()
    renderPanel(WOOD_SAGE, { onSetRepresentative })

    await userEvent.click(
      screen.getByRole('button', { name: '대표 향수로 지정' }),
    )
    expect(onSetRepresentative).toHaveBeenCalled()
  })

  it('이미 대표면 채운 별로 남고 누를 수 없다 — 대표는 한 번에 하나라 여기서 풀 곳이 없다', () => {
    renderPanel({ ...WOOD_SAGE, representative: true })

    const star = screen.getByRole('button', { name: '대표 향수입니다' })
    expect(star).toBeDisabled()
    expect(star).toHaveAttribute('aria-pressed', 'true')
  })

  it('보유 중이 아니면 왜 못 누르는지 이름에 적힌 채로 꺼진다 (A13 — 대표는 보유 중만)', () => {
    renderPanel({ ...WOOD_SAGE, category: 'TRIED' })

    expect(
      screen.getByRole('button', {
        name: '대표 향수는 보유 중 향수만 지정할 수 있습니다',
      }),
    ).toBeDisabled()
  })
})

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
  it('영문 이름이 있으면 크게 적고 국문 이름을 아래 줄에 단다', () => {
    renderPanel(WOOD_SAGE)

    expect(screen.getByText('Wood Sage & Sea Salt')).toBeInTheDocument()
    expect(
      screen.getByText('조 말론 우드 세이지 앤 씨 솔트'),
    ).toBeInTheDocument()
  })

  it('영문 줄이 없으면(백엔드가 아직 주지 않음) 국문 이름만 한 번 적고 빈 줄을 두지 않는다', () => {
    renderPanel({ ...WOOD_SAGE, brandEn: undefined, nameEn: undefined })

    expect(screen.getAllByText('조 말론 우드 세이지 앤 씨 솔트')).toHaveLength(
      1,
    )
    expect(screen.getAllByText('조말론')).toHaveLength(1)
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
