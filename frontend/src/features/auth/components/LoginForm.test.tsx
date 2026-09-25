import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '@/shared/store/authStore'

import { LoginForm } from './LoginForm'

/* 여기서 보려는 것은 "로그인에 성공하면 어디로 보내 달라고 하는가" 하나입니다 */
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
  // 스토어는 테스트 사이에 남습니다 — 비워 두지 않으면 다음 테스트가 이미 로그인 상태입니다
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

  // 남이 만든 링크로도 들어오는 값이라, 로그인 직후 다른 사이트로 튕기지 않게 합니다
  it('앱 밖으로 나가는 주소가 달려 있으면 홈을 넘긴다', async () => {
    renderAt('/login?redirectTo=https%3A%2F%2Fevil.example.com')

    await submit()

    await waitFor(() => expect(onLoggedIn).toHaveBeenCalledWith('/'))
  })
})
