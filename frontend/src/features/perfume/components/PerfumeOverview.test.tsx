import { render as rtlRender, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

import type { PerfumeDetail } from '../types'

import { PerfumeOverview } from './PerfumeOverview'

// 브랜드 · 노트가 링크라 라우터 안에서 그립니다
const render = (ui: React.ReactElement) =>
  rtlRender(ui, { wrapper: MemoryRouter })

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

  it('영문 이름 옆에 향의 성별을 적는다', () => {
    render(
      <PerfumeOverview
        perfume={{ ...PERFUME, gender: 'MALE' }}
        inShelf={false}
        onShelfAction={vi.fn()}
      />,
    )

    expect(screen.getByText('Allure Homme Sport · 남성용')).toBeInTheDocument()
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

    expect(screen.getByText('공용')).toBeInTheDocument()
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
  it('브랜드 이름을 누르면 그 브랜드 화면으로 간다', () => {
    render(
      <PerfumeOverview
        perfume={PERFUME}
        inShelf={false}
        onShelfAction={vi.fn()}
      />,
    )

    expect(screen.getByRole('link', { name: 'Diptyque' })).toHaveAttribute(
      'href',
      '/brands/1',
    )
  })

  // 단종이 확인된 향수는 '단종' 만 적습니다. 확인일 · 근거는 팀이 단종 목록에서 봅니다 (지인 피드백 F5)
  it('단종이 확인된 향수에 단종을 적고 근거 링크는 두지 않는다', () => {
    render(
      <PerfumeOverview
        perfume={{
          ...PERFUME,
          productionStatus: {
            status: 'DISCONTINUED',
            checkedAt: '2026-10-01',
            source: 'https://example.com/discontinued',
          },
        }}
        inShelf={false}
        onShelfAction={vi.fn()}
      />,
    )

    expect(screen.getByText('단종')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /근거/ })).not.toBeInTheDocument()
    // 단종이어도 진열대에 담을 수 있습니다 — 이미 가진 사람이 있습니다
    expect(screen.getByRole('button', { name: '진열대 저장' })).toBeEnabled()
  })

  it('단종인지 모르면 아무것도 적지 않는다', () => {
    render(
      <PerfumeOverview
        perfume={PERFUME}
        inShelf={false}
        onShelfAction={vi.fn()}
      />,
    )

    expect(screen.queryByText('단종')).not.toBeInTheDocument()
  })
})
