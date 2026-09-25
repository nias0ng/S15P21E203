import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { Button } from './Button'

describe('Button', () => {
  it('라벨을 렌더하고 클릭을 전달한다', async () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>저장</Button>)

    await userEvent.click(screen.getByRole('button', { name: '저장' }))

    expect(onClick).toHaveBeenCalledOnce()
  })

  it('isLoading 이면 비활성화되고 클릭이 무시된다', async () => {
    const onClick = vi.fn()
    render(
      <Button isLoading onClick={onClick}>
        저장
      </Button>,
    )

    const button = screen.getByRole('button', { name: '저장' })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')

    await userEvent.click(button)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('className 으로 기본 스타일을 덮어쓸 수 있다', () => {
    render(<Button className="px-7.5">저장</Button>)

    const button = screen.getByRole('button', { name: '저장' })
    expect(button.className).toContain('px-7.5')
    expect(button.className).not.toContain('px-3.75')
  })
})
