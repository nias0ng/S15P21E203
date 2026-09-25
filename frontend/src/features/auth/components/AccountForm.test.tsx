import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '@/shared/store/authStore'

import { AccountForm } from './AccountForm'

const api = vi.hoisted(() => ({
  getMe: vi.fn(),
  checkNicknameAvailability: vi.fn(),
  changeNickname: vi.fn(),
}))

vi.mock('../api', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, ...api }
})

const ME = {
  userId: 1,
  email: 'tester@hyanghae.dev',
  nickname: '향해테스터',
  profileImageUrl: null,
}

const renderForm = async () => {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <AccountForm />
      </MemoryRouter>
    </QueryClientProvider>,
  )
  // 서버 값이 칸에 들어온 뒤부터가 사람이 보는 화면입니다
  await screen.findByDisplayValue(ME.nickname)
}

const nicknameInput = () => screen.getByLabelText('닉네임')

beforeEach(() => {
  api.getMe.mockResolvedValue(ME)
  useAuthStore.getState().setAuth({
    accessToken: 'token',
    user: { id: 1, email: ME.email, nickname: ME.nickname },
  })
})

afterEach(() => {
  useAuthStore.getState().clear()
  vi.clearAllMocks()
})

describe('AccountForm 닉네임 중복 확인', () => {
  it('확인한 닉네임이면 쓸 수 있다고 알린다', async () => {
    api.checkNicknameAvailability.mockResolvedValue(true)
    await renderForm()

    await userEvent.clear(nicknameInput())
    await userEvent.type(nicknameInput(), '새이름')
    await userEvent.click(screen.getByRole('button', { name: '중복 확인' }))

    expect(
      await screen.findByText('사용할 수 있는 닉네임입니다'),
    ).toBeInTheDocument()
  })

  // 확인이 날아가 있는 사이에 고치면, 늦게 온 답은 고치기 전 값의 답입니다
  it('확인 중에 닉네임을 고치면 늦게 온 답을 새 닉네임에 붙이지 않는다', async () => {
    let answer: (available: boolean) => void = () => {}
    api.checkNicknameAvailability.mockReturnValue(
      new Promise<boolean>((resolve) => {
        answer = resolve
      }),
    )
    await renderForm()

    await userEvent.clear(nicknameInput())
    await userEvent.type(nicknameInput(), '새이름')
    await userEvent.click(screen.getByRole('button', { name: '중복 확인' }))
    await userEvent.type(nicknameInput(), '둘')
    await act(async () => answer(true))

    expect(
      screen.queryByText('사용할 수 있는 닉네임입니다'),
    ).not.toBeInTheDocument()
  })
})
