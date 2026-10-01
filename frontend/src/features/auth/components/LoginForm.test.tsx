import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '@/shared/store/authStore'
import { useLocaleStore } from '@/shared/store/localeStore'

import { LoginForm } from './LoginForm'

vi.mock('../api', () => ({
  login: vi.fn(async () => 'access-token'),
  getMe: vi.fn(async () => ({ userId: 1, nickname: '향해', email: 'a@b.c' })),
  toAuthUser: (user: unknown) => user,
}))

const onLoggedIn = vi.fn()

const renderAt = (entry: string) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[entry]}>
        <LoginForm onLoggedIn={onLoggedIn} />
      </MemoryRouter>
    </QueryClientProvider>,
  )

const submit = async () => {
  await userEvent.type(screen.getByLabelText('이메일'), 'a@b.c')
  await userEvent.type(screen.getByLabelText('비밀번호'), 'password1234')
  await userEvent.click(screen.getByRole('button', { name: '로그인' }))
}

afterEach(() => {
  useAuthStore.getState().clear()
  onLoggedIn.mockClear()
})

describe('LoginForm 로그인 뒤 돌아갈 곳', () => {
  it('보던 화면을 주소에 달고 왔으면 그 화면을 넘긴다', async () => {
    renderAt('/login?redirectTo=%2Fcommunity%2Freviews')

    await submit()

    await waitFor(() =>
      expect(onLoggedIn).toHaveBeenCalledWith('/community/reviews'),
    )
  })

  it('쿼리와 함께 달고 온 경로도 그대로 넘긴다', async () => {
    renderAt('/login?redirectTo=%2Fcommunity%2Ffree%3Fpage%3D3')

    await submit()

    await waitFor(() =>
      expect(onLoggedIn).toHaveBeenCalledWith('/community/free?page=3'),
    )
  })

  it('돌아갈 곳이 없으면 홈을 넘긴다', async () => {
    renderAt('/login')

    await submit()

    await waitFor(() => expect(onLoggedIn).toHaveBeenCalledWith('/'))
  })

  it('앱 밖으로 나가는 주소가 달려 있으면 홈을 넘긴다', async () => {
    renderAt('/login?redirectTo=https%3A%2F%2Fevil.example.com')

    await submit()

    await waitFor(() => expect(onLoggedIn).toHaveBeenCalledWith('/'))
  })
})

describe('LoginForm 영어 화면', () => {
  it('보는 도중 언어를 바꾸면 글자가 영어로 바뀐다', async () => {
    renderAt('/login')
    expect(screen.getByRole('button', { name: '로그인' })).toBeInTheDocument()

    act(() => useLocaleStore.getState().setLocale('en'))

    expect(
      await screen.findByRole('button', { name: 'Log in' }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Sign up →' })).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Forgot password?' }),
    ).toBeInTheDocument()
  })
})
