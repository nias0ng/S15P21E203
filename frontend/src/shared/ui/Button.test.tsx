import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { Button } from './Button'

/**
 * 테스트 작성 예시입니다. 새로 만드는 공용 컴포넌트는 이 파일을 따라가면 됩니다.
 *
 * 핵심 원칙: 클래스명이나 내부 상태를 검사하지 않고, 사용자가 보고 하는 것만 검사합니다.
 * getByRole('button', { name: ... }) 처럼 접근성 기준으로 찾으면
 * 마크업을 리팩터링해도 테스트가 안 깨지고, 접근성 문제도 같이 잡힙니다.
 */
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
    render(<Button className="px-8">저장</Button>)

    // cn() 이 twMerge 를 거치므로 기본값 px-4 는 사라지고 px-8 만 남습니다
    const button = screen.getByRole('button', { name: '저장' })
    expect(button.className).toContain('px-8')
    expect(button.className).not.toContain('px-4')
  })
})
