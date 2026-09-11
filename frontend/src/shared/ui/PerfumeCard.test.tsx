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

  it('rank 를 넘기면 몇 번째인지 읽을 수 있게 번호를 단다', () => {
    renderCard(<PerfumeCard name="산탈 33 EDP" rank={3} />)

    // 숫자만 그리면 낭독기에 "3" 만 들려서 무슨 3인지 알 수 없습니다.
    expect(screen.getByText(/목록\s*3\s*번째/)).toBeInTheDocument()
  })

  it('rank 를 넘기지 않으면 번호를 달지 않는다', () => {
    renderCard(<PerfumeCard name="산탈 33 EDP" />)

    expect(screen.queryByText(/번째/)).not.toBeInTheDocument()
  })

  it('to 를 넘기면 카드 전체가 상세로 가는 링크가 된다', () => {
    renderCard(<PerfumeCard name="산탈 33 EDP" to="/perfumes/16" />)

    expect(screen.getByRole('link', { name: /산탈 33 EDP/ })).toHaveAttribute(
      'href',
      '/perfumes/16',
    )
  })
})
