import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { Button } from './Button'
import { EmptyState } from './EmptyState'

describe('EmptyState', () => {
  it('제목과 안내를 보여준다', () => {
    render(
      <EmptyState
        title="검색 결과가 없습니다"
        description="검색어를 바꿔 보세요."
      />,
    )

    expect(screen.getByText('검색 결과가 없습니다')).toBeInTheDocument()
    expect(screen.getByText('검색어를 바꿔 보세요.')).toBeInTheDocument()
  })

  it('onRetry 가 없으면 [다시 시도] 를 그리지 않는다', () => {
    render(<EmptyState title="검색 결과가 없습니다" />)

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('onRetry 를 넘기면 [다시 시도] 가 서고 누르면 부른다', async () => {
    const onRetry = vi.fn()
    render(<EmptyState title="향수를 불러오지 못했습니다" onRetry={onRetry} />)

    await userEvent.click(screen.getByRole('button', { name: '다시 시도' }))

    expect(onRetry).toHaveBeenCalledOnce()
  })

  it('action 과 함께 넘기면 action 뒤에 [다시 시도] 가 선다', () => {
    render(
      <EmptyState
        title="브랜드를 찾을 수 없습니다"
        action={<Button>브랜드 목록으로</Button>}
        onRetry={vi.fn()}
      />,
    )

    expect(
      screen.getAllByRole('button').map((button) => button.textContent),
    ).toEqual(['브랜드 목록으로', '다시 시도'])
  })
})
