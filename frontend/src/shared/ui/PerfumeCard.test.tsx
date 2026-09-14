import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'

import { PerfumeCard } from '@/shared/ui/PerfumeCard'

/** Link 를 쓰므로 라우터 안에서 그려야 합니다 */
const renderCard = (ui: React.ReactNode) =>
  render(<MemoryRouter>{ui}</MemoryRouter>)

describe('PerfumeCard', () => {
  it('이름과 브랜드를 보여준다', () => {
    renderCard(<PerfumeCard name="산탈 33 EDP" brand="르라보" />)

    expect(screen.getByText('산탈 33 EDP')).toBeInTheDocument()
    expect(screen.getByText('르라보')).toBeInTheDocument()
  })

  it('to 를 넘기면 카드 전체가 상세로 가는 링크가 된다', () => {
    renderCard(<PerfumeCard name="산탈 33 EDP" to="/perfumes/16" />)

    expect(screen.getByRole('link', { name: /산탈 33 EDP/ })).toHaveAttribute(
      'href',
      '/perfumes/16',
    )
  })
})
