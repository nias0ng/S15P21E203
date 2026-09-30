import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

import { PerfumeCard } from '@/shared/ui/PerfumeCard'

const renderCard = (ui: React.ReactNode) =>
  render(<MemoryRouter>{ui}</MemoryRouter>)

describe('PerfumeCard', () => {
  it('큰 이름과 작은 이름을 두 줄로 보여준다', () => {
    renderCard(
      <PerfumeCard name="상탈 33" subName="Santal 33" to="/perfumes/16" />,
    )

    expect(screen.getByText('상탈 33')).toBeInTheDocument()
    expect(screen.getByText('Santal 33')).toBeInTheDocument()
  })

  it('작은 이름이 큰 이름과 같으면 아랫줄을 적지 않는다', () => {
    renderCard(
      <PerfumeCard name="Oud Wood" subName="Oud Wood" to="/perfumes/7" />,
    )

    expect(screen.getByText('Oud Wood')).toBeInTheDocument()
    expect(screen.getAllByText('Oud Wood')).toHaveLength(1)
  })

  it('순위 딱지는 앞말을 붙여 읽는다 — 기본은 인기', () => {
    renderCard(
      <>
        <PerfumeCard name="상탈 33" rank={1} to="/perfumes/16" />
        <PerfumeCard
          name="오 로즈"
          rank={2}
          rankLabel="추천"
          to="/perfumes/7"
        />
      </>,
    )

    expect(screen.getByText('인기 1위')).toBeInTheDocument()
    expect(screen.getByText('추천 2위')).toBeInTheDocument()
  })

  it('카드 전체가 상세로 가는 링크다', () => {
    renderCard(<PerfumeCard name="산탈 33 EDP" to="/perfumes/16" />)

    expect(screen.getByRole('link', { name: /산탈 33 EDP/ })).toHaveAttribute(
      'href',
      '/perfumes/16',
    )
  })

  it('onToggle 을 주면 링크 대신 아래 칸을 여닫는 단추가 된다', async () => {
    const onToggle = vi.fn()
    renderCard(
      <PerfumeCard
        name="산탈 33 EDP"
        onToggle={onToggle}
        expanded={false}
        controls="reason"
      />,
    )

    const card = screen.getByRole('button', { name: /산탈 33 EDP/ })
    expect(card).toHaveAttribute('aria-expanded', 'false')
    expect(card).toHaveAttribute('aria-controls', 'reason')
    expect(screen.queryByRole('link')).not.toBeInTheDocument()

    await userEvent.click(card)
    expect(onToggle).toHaveBeenCalledOnce()
  })
})
