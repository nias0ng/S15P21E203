import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it } from 'vitest'

import { useAuthStore } from '@/shared/store/authStore'

import { AuthLinkButton } from './AuthLinkButton'

const renderButton = () =>
  render(
    <MemoryRouter>
      <AuthLinkButton
        to="/community/free/write"
        description="글은 로그인한 뒤에 쓸 수 있습니다"
      >
        글쓰기
      </AuthLinkButton>
    </MemoryRouter>,
  )

afterEach(() => useAuthStore.getState().clear())

describe('AuthLinkButton', () => {
  it('로그인했으면 그냥 링크다 — 새 탭으로 열기와 링크 복사가 살아 있어야 합니다', () => {
    useAuthStore.getState().setAuth({
      accessToken: 'token',
      user: { id: 1, email: 'a@b.com', nickname: '항해자' },
    })

    renderButton()

    expect(screen.getByRole('link', { name: '글쓰기' })).toHaveAttribute(
      'href',
      '/community/free/write',
    )
  })

  it('로그인하지 않았으면 링크가 아니라 단추다', () => {
    renderButton()

    expect(screen.getByRole('button', { name: '글쓰기' })).toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: '글쓰기' }),
    ).not.toBeInTheDocument()
  })

  /* 가서 막지 않고 여기서 막습니다 — 다 쓰고 [등록] 에서 막히면 쓴 것을 잃습니다 */
  it('로그인하지 않고 누르면 그 자리에서 로그인 모달이 뜬다', async () => {
    renderButton()

    await userEvent.click(screen.getByRole('button', { name: '글쓰기' }))

    expect(
      screen.getByRole('dialog', { name: '로그인이 필요합니다' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('글은 로그인한 뒤에 쓸 수 있습니다'),
    ).toBeInTheDocument()
  })
})
