import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { Textarea } from './Textarea'

describe('Textarea', () => {
  it('라벨로 찾을 수 있고 입력이 전달된다', async () => {
    const onChange = vi.fn()
    render(<Textarea label="본문" onChange={onChange} />)

    await userEvent.type(screen.getByRole('textbox', { name: '본문' }), '가')

    expect(onChange).toHaveBeenCalled()
  })

  it('hideLabel 이어도 라벨로 찾을 수 있다', () => {
    render(
      <Textarea label="댓글 내용" hideLabel placeholder="댓글을 입력하세요" />,
    )

    // 시각적으로만 숨기는 것이라 접근성 이름은 남아 있어야 합니다
    expect(
      screen.getByRole('textbox', { name: '댓글 내용' }),
    ).toBeInTheDocument()
  })

  it('error 가 있으면 aria-invalid 가 붙고 메시지가 보인다', () => {
    render(<Textarea label="본문" error="내용을 입력하세요" />)

    const textarea = screen.getByRole('textbox', { name: '본문' })
    expect(textarea).toHaveAttribute('aria-invalid', 'true')
    expect(textarea).toHaveAccessibleDescription('내용을 입력하세요')
  })

  it('error 가 없으면 aria-invalid 도 설명도 없다', () => {
    render(<Textarea label="메모" />)

    const textarea = screen.getByRole('textbox', { name: '메모' })
    expect(textarea).not.toHaveAttribute('aria-invalid')
    expect(textarea).not.toHaveAttribute('aria-describedby')
  })

  it('className 으로 기본 글자 크기를 덮어쓸 수 있다', () => {
    render(<Textarea label="본문" className="text-base" />)

    // cn() 이 twMerge 를 거치므로 기본값 text-body 는 사라지고 text-base 만 남습니다
    const textarea = screen.getByRole('textbox', { name: '본문' })
    expect(textarea.className).toContain('text-base')
    expect(textarea.className).not.toContain('text-body')
  })

  it('rows 같은 textarea 속성이 그대로 전달된다', () => {
    render(<Textarea label="본문" rows={12} required />)

    const textarea = screen.getByRole('textbox', { name: '본문' })
    expect(textarea).toHaveAttribute('rows', '12')
    expect(textarea).toBeRequired()
  })
})
