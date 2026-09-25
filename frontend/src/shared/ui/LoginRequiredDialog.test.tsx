import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

import { LoginRequiredDialog } from './LoginRequiredDialog'

const renderDialog = (
  props: Partial<Parameters<typeof LoginRequiredDialog>[0]> = {},
) =>
  render(
    <MemoryRouter>
      <LoginRequiredDialog open onClose={vi.fn()} {...props} />
    </MemoryRouter>,
  )

describe('LoginRequiredDialog', () => {
  it('자리에 맞는 문구를 넘기면 그것을 보여준다', () => {
    renderDialog({ description: '댓글은 로그인한 뒤에 쓸 수 있습니다.' })

    expect(
      screen.getByText('댓글은 로그인한 뒤에 쓸 수 있습니다.'),
    ).toBeInTheDocument()
  })

  it('문구를 넘기지 않으면 기본 문구를 쓴다', () => {
    renderDialog()

    expect(
      screen.getByText('추천 결과는 로그인 없이도 볼 수 있습니다.'),
    ).toBeInTheDocument()
  })

  it('취소를 누르면 닫기를 알린다', async () => {
    const onClose = vi.fn()
    renderDialog({ onClose })

    await userEvent.click(screen.getByRole('button', { name: '취소' }))

    expect(onClose).toHaveBeenCalledOnce()
  })

  it('회원가입 · 로그인은 돌아올 경로를 단 링크다', () => {
    renderDialog({ redirectTo: '/community/free/write' })

    expect(screen.getByRole('link', { name: '회원가입' })).toHaveAttribute(
      'href',
      '/signup?redirectTo=%2Fcommunity%2Ffree%2Fwrite',
    )
    expect(screen.getByRole('link', { name: '로그인' })).toHaveAttribute(
      'href',
      '/login?redirectTo=%2Fcommunity%2Ffree%2Fwrite',
    )
  })

  it('돌아올 경로가 없으면 로그인 화면으로만 보낸다', () => {
    renderDialog()

    expect(screen.getByRole('link', { name: '로그인' })).toHaveAttribute(
      'href',
      '/login',
    )
  })
})
