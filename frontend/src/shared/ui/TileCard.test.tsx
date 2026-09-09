import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'

import { TileCard } from './TileCard'

const renderTile = (ui: React.ReactNode) =>
  render(<MemoryRouter>{ui}</MemoryRouter>)

describe('TileCard', () => {
  it('제목을 링크로 보여준다', () => {
    renderTile(
      <TileCard
        to="/notes/1"
        media={<img alt="베르가못" src="/a.png" />}
        title="베르가못"
      />,
    )

    const link = screen.getByRole('link', { name: /베르가못/ })
    expect(link).toHaveAttribute('href', '/notes/1')
  })

  it('caption 을 주면 제목 아래에 보여준다', () => {
    renderTile(
      <TileCard to="/brands" media={null} title="딥티크" caption="향수 42개" />,
    )

    expect(screen.getByText('딥티크')).toBeInTheDocument()
    expect(screen.getByText('향수 42개')).toBeInTheDocument()
  })

  it('caption 이 없으면 그리지 않는다', () => {
    renderTile(<TileCard to="/notes/2" media={null} title="샌달우드" />)

    expect(screen.getByText('샌달우드')).toBeInTheDocument()
    expect(screen.queryByText(/향수 .*개/)).not.toBeInTheDocument()
  })

  it('media 로 넘긴 것을 여러 개라도 그대로 그린다', () => {
    renderTile(
      <TileCard
        to="/collections/1"
        media={
          <>
            <img alt="첫 번째" src="/1.png" />
            <img alt="두 번째" src="/2.png" />
            <img alt="세 번째" src="/3.png" />
          </>
        }
        title="출근길에 쓰는 향"
      />,
    )

    expect(screen.getAllByRole('img')).toHaveLength(3)
  })
})
