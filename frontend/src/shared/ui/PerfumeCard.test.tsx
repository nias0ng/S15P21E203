import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'

import { PerfumeCard } from '@/shared/ui/PerfumeCard'

/** Link 를 쓰므로 라우터 안에서 그려야 합니다 */
const renderCard = (ui: React.ReactNode) =>
  render(<MemoryRouter>{ui}</MemoryRouter>)

describe('PerfumeCard', () => {
  it('한국어 이름 · 원어 이름 · 브랜드를 세 줄로 보여준다', () => {
    renderCard(
      <PerfumeCard name="상탈 33" nameOriginal="Santal 33" brand="르 라보" />,
    )

    expect(screen.getByText('상탈 33')).toBeInTheDocument()
    expect(screen.getByText('Santal 33')).toBeInTheDocument()
    expect(screen.getByText('르 라보')).toBeInTheDocument()
  })

  /*
    한국어 이름이 없는 향수는 부르는 쪽이 `name={nameKo ?? name}` 으로 넘겨서
    두 값이 같아집니다. 그대로 그리면 같은 글자가 두 줄로 겹칩니다.
  */
  it('원어 이름이 큰 이름과 같으면 아랫줄을 적지 않는다', () => {
    renderCard(<PerfumeCard name="Oud Wood" nameOriginal="Oud Wood" />)

    expect(screen.getByText('Oud Wood')).toBeInTheDocument()
    expect(screen.getAllByText('Oud Wood')).toHaveLength(1)
  })

  it('원어 이름이 없으면 이름과 브랜드 두 줄로 선다', () => {
    renderCard(<PerfumeCard name="상탈 33" brand="르 라보" />)

    expect(screen.getByText('상탈 33')).toBeInTheDocument()
    expect(screen.getByText('르 라보')).toBeInTheDocument()
  })

  it('to 를 넘기면 카드 전체가 상세로 가는 링크가 된다', () => {
    renderCard(<PerfumeCard name="산탈 33 EDP" to="/perfumes/16" />)

    expect(screen.getByRole('link', { name: /산탈 33 EDP/ })).toHaveAttribute(
      'href',
      '/perfumes/16',
    )
  })
})
