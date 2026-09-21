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

/* 단추 하나가 담기와 빼기를 겸해, 라벨이 상태를 잘못 말하면 담으려다 빼게 됩니다 */
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

  /* 한쪽이 빠졌을 때 가운뎃점이 혼자 남는 것이 이 줄에서 가장 나기 쉬운 오류입니다 */
  it('영문 이름 옆에 향의 성별을 적는다', () => {
    render(
      <PerfumeOverview
        perfume={{ ...PERFUME, gender: 'MALE' }}
        inShelf={false}
        onShelfAction={vi.fn()}
      />,
    )

    expect(screen.getByText('Allure Homme Sport · male')).toBeInTheDocument()
  })

  it('성별을 모르면 영문 이름만 적는다', () => {
    render(
      <PerfumeOverview
        perfume={{ ...PERFUME, gender: null }}
        inShelf={false}
        onShelfAction={vi.fn()}
      />,
    )

    expect(screen.getByText('Allure Homme Sport')).toBeInTheDocument()
  })

  it('한글 이름이 없으면 제목이 영문이라 그 줄에는 성별만 남는다', () => {
    render(
      <PerfumeOverview
        perfume={{ ...PERFUME, nameKo: null, gender: 'UNISEX' }}
        inShelf={false}
        onShelfAction={vi.fn()}
      />,
    )

    expect(screen.getByText('unisex')).toBeInTheDocument()
    // 영문 이름은 제목(h1)에만 있습니다
    expect(
      screen.getByRole('heading', { name: 'Allure Homme Sport' }),
    ).toBeInTheDocument()
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
