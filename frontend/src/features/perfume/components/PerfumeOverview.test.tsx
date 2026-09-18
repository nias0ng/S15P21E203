import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { PerfumeDetail } from '../types'

import { PerfumeOverview } from './PerfumeOverview'

const PERFUME: PerfumeDetail = {
  perfumeId: 1,
  name: 'Allure Homme Sport',
  nameKo: '알뤼르 옴므 스포츠',
  gender: null,
  concentration: null,
  brand: { brandId: 1, name: 'Diptyque' },
  images: [],
  prices: [],
  myReviewId: null,
}

/**
 * 단추 하나가 두 가지 일을 합니다 — 담기와 빼기. 라벨이 상태를 잘못 말하면
 * 사용자가 담으려다 빼게 되므로, 그 갈림만 잡아 둡니다.
 */
describe('PerfumeOverview', () => {
  it('진열대에 없으면 [진열대 저장] 이다', async () => {
    const onShelfAction = vi.fn()
    render(
      <PerfumeOverview
        perfume={PERFUME}
        inShelf={false}
        onShelfAction={onShelfAction}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: '진열대 저장' }))
    expect(onShelfAction).toHaveBeenCalledOnce()
  })

  it('이미 담긴 향수는 [진열대 해제] 로 바뀐다', () => {
    render(
      <PerfumeOverview perfume={PERFUME} inShelf onShelfAction={vi.fn()} />,
    )

    expect(
      screen.getByRole('button', { name: '진열대 해제' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: '진열대 저장' }),
    ).not.toBeInTheDocument()
  })

  it('담겼는지 모르는 동안에는 누를 수 없다', () => {
    render(
      <PerfumeOverview
        perfume={PERFUME}
        inShelf={false}
        shelfPending
        onShelfAction={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: '진열대 저장' })).toBeDisabled()
  })
})
