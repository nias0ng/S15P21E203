import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { Pagination } from './Pagination'

describe('Pagination', () => {
  it('페이지가 하나면 아무것도 그리지 않는다', () => {
    const { container } = render(
      <Pagination
        page={0}
        size={20}
        totalElements={15}
        onPageChange={vi.fn()}
      />,
    )

    expect(container).toBeEmptyDOMElement()
  })

  it('지금 보고 있는 쪽을 알려준다', () => {
    render(
      <Pagination
        page={2}
        size={10}
        totalElements={100}
        onPageChange={vi.fn()}
      />,
    )

    expect(
      screen.getByRole('button', { current: 'page' }),
    ).toHaveAccessibleName('3쪽')
  })

  it('번호를 누르면 0부터 세는 값을 넘긴다', async () => {
    const onPageChange = vi.fn()
    render(
      <Pagination
        page={0}
        size={10}
        totalElements={100}
        onPageChange={onPageChange}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: '3쪽' }))

    expect(onPageChange).toHaveBeenCalledWith(2)
  })

  it('첫 쪽에서는 이전이, 마지막 쪽에서는 다음이 눌리지 않는다', () => {
    const { rerender } = render(
      <Pagination
        page={0}
        size={10}
        totalElements={30}
        onPageChange={vi.fn()}
      />,
    )
    expect(screen.getByRole('button', { name: '이전 페이지' })).toBeDisabled()

    rerender(
      <Pagination
        page={2}
        size={10}
        totalElements={30}
        onPageChange={vi.fn()}
      />,
    )
    expect(screen.getByRole('button', { name: '다음 페이지' })).toBeDisabled()
  })

  it('페이지가 많아도 번호는 다섯 개까지만 보여준다', () => {
    render(
      <Pagination
        page={10}
        size={10}
        totalElements={1000}
        onPageChange={vi.fn()}
      />,
    )

    // 이전 · 다음을 뺀 나머지가 번호입니다
    expect(screen.getAllByRole('button')).toHaveLength(WINDOW_WITH_ARROWS)
    expect(screen.getByRole('button', { name: '9쪽' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '13쪽' })).toBeInTheDocument()
  })
})

const WINDOW_WITH_ARROWS = 7
