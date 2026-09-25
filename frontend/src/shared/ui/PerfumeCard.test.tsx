import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'

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

  it('카드 전체가 상세로 가는 링크다', () => {
    renderCard(<PerfumeCard name="산탈 33 EDP" to="/perfumes/16" />)

    expect(screen.getByRole('link', { name: /산탈 33 EDP/ })).toHaveAttribute(
      'href',
      '/perfumes/16',
    )
  })
})
