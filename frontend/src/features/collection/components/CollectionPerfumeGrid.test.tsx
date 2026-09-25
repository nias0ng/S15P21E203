import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

import type { CollectionPerfume } from '../types'

import { CollectionPerfumeGrid } from './CollectionPerfumeGrid'

const PERFUMES: CollectionPerfume[] = [
  {
    shelfItemId: 101,
    perfumeId: 11,
    name: 'Gypsy Water',
    brand: 'Byredo',
    thumbnailUrl: '/bottles/gypsy.webp',
  },
  // 브랜드 · 사진이 비어 있는 향수가 실제로 옵니다
  {
    shelfItemId: 102,
    perfumeId: 12,
    name: 'Francois Charles',
    brand: null,
    thumbnailUrl: null,
  },
]

/** 넘기지 않은 콜백은 vi.fn() 으로 채웁니다 — 검사할 것만 넘기면 됩니다 */
function renderGrid(
  props: Partial<Parameters<typeof CollectionPerfumeGrid>[0]>,
) {
  // 칸이 향수 상세로 가는 링크라 라우터 안에서 그려야 합니다
  return render(
    <MemoryRouter>
      <CollectionPerfumeGrid
        perfumes={PERFUMES}
        onRemove={vi.fn()}
        onAdd={vi.fn()}
        {...props}
      />
    </MemoryRouter>,
  )
}

describe('CollectionPerfumeGrid 향수 칸', () => {
  it('향수마다 상세로 가는 칸을 세우고 브랜드와 이름을 적는다', () => {
    renderGrid({})

    const link = screen.getByRole('link', { name: /Gypsy Water/ })
    expect(link).toHaveAttribute('href', '/perfumes/11')
    expect(link).toHaveTextContent('Byredo')
  })

  it('[×] 는 그 향수를 넘기고, 누를 때 칸(링크)까지 눌리지 않는다', async () => {
    const onRemove = vi.fn()
    renderGrid({ onRemove })

    const remove = screen.getByRole('button', {
      name: 'Francois Charles 컬렉션에서 제거',
    })
    expect(remove.closest('a')).toBeNull()

    await userEvent.click(remove)
    expect(onRemove).toHaveBeenCalledWith(PERFUMES[1])
  })

  it('마지막 빈 칸을 누르면 향수를 더 담는다 — 비었으면 첫 향수를 담자고 한다', async () => {
    const onAdd = vi.fn()
    const { unmount } = renderGrid({ onAdd })

    await userEvent.click(screen.getByRole('button', { name: /향수 더 담기/ }))
    expect(onAdd).toHaveBeenCalledOnce()

    unmount()
    renderGrid({ perfumes: [] })
    expect(
      screen.getByRole('button', { name: /첫 향수 담기/ }),
    ).toBeInTheDocument()
  })
})
