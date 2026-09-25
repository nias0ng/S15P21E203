import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'

import { PerfumeCard } from '@/shared/ui/PerfumeCard'

/** Link 를 쓰므로 라우터 안에서 그려야 합니다 */
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

  /*
    한쪽 이름이 없는 향수는 부르는 쪽이 `name={a ?? b}` 으로 넘겨서 두 값이
    같아집니다. 그대로 그리면 같은 글자가 두 줄로 겹칩니다.
  */
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
