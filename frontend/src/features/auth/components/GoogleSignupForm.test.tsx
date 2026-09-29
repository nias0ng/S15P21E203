import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/shared/api/http'
import { useAuthStore } from '@/shared/store/authStore'

import {
  checkNicknameAvailability,
  getGoogleSignup,
  getMe,
  googleSignup,
} from '../api'

import { GoogleSignupForm } from './GoogleSignupForm'

// NOTE: `toAuthUser` 는 진짜를 씁니다 — 응답을 스토어 모양으로 바꾸는 것까지가 이 폼의 일입니다.
vi.mock('../api', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getGoogleSignup: vi.fn(),
  googleSignup: vi.fn(),
  getMe: vi.fn(),
  checkNicknameAvailability: vi.fn(),
}))

const infoCall = vi.mocked(getGoogleSignup)
const signupCall = vi.mocked(googleSignup)
const nicknameCheck = vi.mocked(checkNicknameAvailability)
const meCall = vi.mocked(getMe)

const EMAIL = 'sailor@gmail.com'

const ticketMissing = () =>
  new ApiError(
    401,
    'AUTH_INVALID_GOOGLE_SIGNUP_TICKET',
    '가입 시간이 지났습니다.',
  )

beforeEach(() => {
  vi.resetAllMocks()
  useAuthStore.getState().clear()
  infoCall.mockResolvedValue({ email: EMAIL, suggestedNickname: '향해자' })
  nicknameCheck.mockResolvedValue(true)
  meCall.mockResolvedValue({
    userId: 7,
    email: EMAIL,
    nickname: '향해자',
    profileImageUrl: null,
    hasPassword: false,
    googleConnected: true,
  })
})

const renderForm = (
  onSignedUp: (from: string) => void = () => {},
  path = '/signup/google',
) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[path]}>
        <GoogleSignupForm onSignedUp={onSignedUp} />
      </MemoryRouter>
    </QueryClientProvider>,
  )

const submitButton = () => screen.getByRole('button', { name: '가입하기' })

const passNicknameCheck = async () => {
  await userEvent.click(screen.getByRole('button', { name: '중복 확인' }))
  await screen.findByText('사용할 수 있는 닉네임입니다')
}

describe('GoogleSignupForm', () => {
  it('가입표 쿠키가 없으면 Google 로그인부터 다시 하라고 한다', async () => {
    infoCall.mockRejectedValue(ticketMissing())
    renderForm()

    expect(
      await screen.findByText(/Google 계정 확인 정보가 없습니다/),
    ).toBeInTheDocument()
    expect(screen.queryByLabelText('닉네임')).not.toBeInTheDocument()
  })

  it('Google 이메일과 추천 닉네임을 채워 보여 준다', async () => {
    renderForm()

    expect(await screen.findByText(EMAIL)).toBeInTheDocument()
    expect(screen.getByLabelText('닉네임')).toHaveValue('향해자')
  })

  it('중복 확인을 통과해야 가입할 수 있고, 가입하면 원래 가려던 곳으로 로그인까지 된다', async () => {
    signupCall.mockResolvedValue('access-token')
    const onSignedUp = vi.fn()
    renderForm(onSignedUp, '/signup/google?redirectTo=%2Fshelf')

    await screen.findByText(EMAIL)
    expect(submitButton()).toBeDisabled()
    await passNicknameCheck()
    await userEvent.click(submitButton())

    await vi.waitFor(() => expect(onSignedUp).toHaveBeenCalledWith('/shelf'))
    expect(signupCall).toHaveBeenCalledWith('향해자')
    expect(useAuthStore.getState().accessToken).toBe('access-token')
    expect(useAuthStore.getState().user?.id).toBe(7)
  })

  it('서버가 닉네임 중복이라 하면 닉네임 칸이 뒤집히고 가입표는 그대로 쓴다', async () => {
    signupCall.mockRejectedValueOnce(
      new ApiError(
        409,
        'AUTH_NICKNAME_ALREADY_EXISTS',
        '이미 사용 중인 닉네임입니다.',
      ),
    )
    renderForm()

    await screen.findByText(EMAIL)
    await passNicknameCheck()
    await userEvent.click(submitButton())

    await screen.findByRole('alert')
    expect(screen.getByLabelText('닉네임')).toHaveAttribute(
      'aria-invalid',
      'true',
    )
    expect(submitButton()).toBeDisabled()
  })

  it('닉네임을 고르는 사이 가입표가 만료되면 Google 로그인부터 다시 하라고 한다', async () => {
    signupCall.mockRejectedValueOnce(ticketMissing())
    renderForm()

    await screen.findByText(EMAIL)
    await passNicknameCheck()
    await userEvent.click(submitButton())

    expect(
      await screen.findByText(/가입 시간이 지났습니다/),
    ).toBeInTheDocument()
    expect(screen.queryByLabelText('닉네임')).not.toBeInTheDocument()
  })
})
