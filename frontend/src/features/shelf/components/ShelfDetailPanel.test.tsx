import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { ShelfItem } from '../types'

import { ShelfDetailPanel } from './ShelfDetailPanel'

const WOOD_SAGE: ShelfItem = {
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
  rating: 4,
  memo: '출근용으로 제일 자주 쓴다.',
  memoUpdatedAt: '2026-08-20T00:00:00Z',
}

/** 넘기지 않은 콜백은 vi.fn() 으로 채웁니다 — 검사할 것만 넘기면 됩니다 */
function renderPanel(
  item: ShelfItem | null,
  props: Partial<Parameters<typeof ShelfDetailPanel>[0]> = {},
) {
  return render(
    <ShelfDetailPanel
      item={item}
      onSetRepresentative={vi.fn()}
      onChangeRating={vi.fn()}
      onChangeCategory={vi.fn()}
      onRemove={vi.fn()}
      onSaveMemo={vi.fn()}
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
  it('평소에는 읽기만 하고, 수정을 눌러야 입력칸이 열린다', async () => {
    renderPanel(WOOD_SAGE)

    expect(screen.getByText('출근용으로 제일 자주 쓴다.')).toBeInTheDocument()
    expect(screen.queryByLabelText('개인 메모')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: '수정' }))
    expect(screen.getByLabelText('개인 메모')).toHaveValue(
      '출근용으로 제일 자주 쓴다.',
    )
  })

  it('고치지 않았으면 저장할 수 없다', async () => {
    renderPanel(WOOD_SAGE)

    await userEvent.click(screen.getByRole('button', { name: '수정' }))
    expect(screen.getByRole('button', { name: '저장' })).toBeDisabled()

    await userEvent.type(
      screen.getByLabelText('개인 메모'),
      ' 한 번이 딱 맞다.',
    )
    expect(screen.getByRole('button', { name: '저장' })).toBeEnabled()
  })

  it('취소하면 고치던 글을 버리고 원래 글로 돌아간다', async () => {
    const onSaveMemo = vi.fn()
    renderPanel(WOOD_SAGE, { onSaveMemo })

    await userEvent.click(screen.getByRole('button', { name: '수정' }))
    await userEvent.type(screen.getByLabelText('개인 메모'), ' 버릴 글')
    await userEvent.click(screen.getByRole('button', { name: '취소' }))

    expect(onSaveMemo).not.toHaveBeenCalled()
    expect(screen.getByText('출근용으로 제일 자주 쓴다.')).toBeInTheDocument()
  })

  it('메모가 없으면 "추가" 로 열린다 — 고칠 글이 없는데 "수정" 이라고 적지 않습니다', () => {
    renderPanel({ ...WOOD_SAGE, memo: null, memoUpdatedAt: null })

    expect(screen.getByRole('button', { name: '추가' })).toBeInTheDocument()
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
