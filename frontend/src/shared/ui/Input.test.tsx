import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { Input } from './Input'

describe('Input', () => {
  it('라벨로 찾을 수 있고 입력이 전달된다', async () => {
    const onChange = vi.fn()
    render(<Input label="닉네임" onChange={onChange} />)

    await userEvent.type(screen.getByRole('textbox', { name: '닉네임' }), '가')

    expect(onChange).toHaveBeenCalled()
  })

  it('hint 는 입력칸의 설명으로 읽힌다', () => {
    render(<Input label="닉네임" hint="두 글자 이상" />)

    expect(
      screen.getByRole('textbox', { name: '닉네임' }),
    ).toHaveAccessibleDescription('두 글자 이상')
  })

  it('error 와 hint 가 함께 있으면 error 만 보이고 error 만 설명으로 읽힌다', () => {
    render(
      <Input
        label="닉네임"
        hint="두 글자 이상"
        error="이미 쓰는 닉네임입니다"
      />,
    )

    const input = screen.getByRole('textbox', { name: '닉네임' })
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAccessibleDescription('이미 쓰는 닉네임입니다')
    expect(input.getAttribute('aria-describedby')?.split(' ')).toHaveLength(1)
    expect(screen.queryByText('두 글자 이상')).not.toBeInTheDocument()
  })

  it('error 도 hint 도 없으면 설명을 걸지 않는다', () => {
    render(<Input label="닉네임" />)

    const input = screen.getByRole('textbox', { name: '닉네임' })
    expect(input).not.toHaveAttribute('aria-describedby')
    expect(input).not.toHaveAttribute('aria-invalid')
  })
})
