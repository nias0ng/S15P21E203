import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/shared/api/http'

import {
  checkEmailAvailability,
  checkNicknameAvailability,
  signup,
} from '../api'

import { SignupForm } from './SignupForm'

vi.mock('../api', () => ({
  signup: vi.fn(),
  checkEmailAvailability: vi.fn(),
  checkNicknameAvailability: vi.fn(),
}))

const emailCheck = vi.mocked(checkEmailAvailability)
const nicknameCheck = vi.mocked(checkNicknameAvailability)
const signupCall = vi.mocked(signup)

beforeEach(() => {
  vi.resetAllMocks()
  emailCheck.mockResolvedValue(true)
  nicknameCheck.mockResolvedValue(true)
})

const conflict = (code: string, message: string) =>
  signupCall.mockRejectedValueOnce(new ApiError(409, code, message))

const renderForm = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <SignupForm />
      </MemoryRouter>
    </QueryClientProvider>,
  )

const submitButton = () => screen.getByRole('button', { name: '가입하기' })

const checkButton = (field: 'email' | 'nickname'): HTMLElement => {
  const [email, nickname] = screen.getAllByRole('button', { name: '중복 확인' })
  const button = field === 'email' ? email : nickname
  if (button === undefined) {
    throw new Error(`${field} [중복 확인] 버튼을 찾지 못했습니다`)
  }
  return button
}

const fillExceptDomain = async () => {
  await userEvent.type(screen.getByLabelText('이메일 아이디'), 'hyanghae')
  await userEvent.type(screen.getByLabelText('비밀번호'), 'password1234')
  await userEvent.type(screen.getByLabelText('비밀번호 확인'), 'password1234')
  await userEvent.type(screen.getByLabelText('닉네임'), '향해테스터')
}

const fillAll = async () => {
  await fillExceptDomain()
  await userEvent.selectOptions(
    screen.getByLabelText('이메일 도메인'),
    'naver.com',
  )
}

const passBothChecks = async () => {
  await userEvent.click(checkButton('email'))
  await userEvent.click(checkButton('nickname'))
  await screen.findByText('사용할 수 있는 이메일입니다')
  await screen.findByText('사용할 수 있는 닉네임입니다')
}

describe('SignupForm 이메일 도메인', () => {
  it('도메인을 고르기 전에는 가입할 수 없다', async () => {
    renderForm()

    await fillExceptDomain()

    expect(submitButton()).toBeDisabled()
  })

  it('도메인을 고르기 전에는 이메일 중복 확인도 누를 수 없다', async () => {
    renderForm()

    await fillExceptDomain()

    expect(checkButton('email')).toBeDisabled()
  })
})

describe('SignupForm 중복 확인', () => {
  it('중복 확인을 하지 않으면 가입할 수 없다', async () => {
    renderForm()

    await fillAll()

    expect(submitButton()).toBeDisabled()
  })

  it('이메일만 확인해서는 가입할 수 없다', async () => {
    renderForm()

    await fillAll()
    await userEvent.click(checkButton('email'))
    await screen.findByText('사용할 수 있는 이메일입니다')

    expect(submitButton()).toBeDisabled()
  })

  it('닉네임만 확인해서는 가입할 수 없다', async () => {
    renderForm()

    await fillAll()
    await userEvent.click(checkButton('nickname'))
    await screen.findByText('사용할 수 있는 닉네임입니다')

    expect(submitButton()).toBeDisabled()
  })

  it('둘 다 확인을 통과하면 가입할 수 있다', async () => {
    renderForm()

    await fillAll()
    await passBothChecks()

    expect(submitButton()).toBeEnabled()
  })

  it('이미 쓰는 이메일이면 확인을 해도 가입할 수 없다', async () => {
    emailCheck.mockResolvedValue(false)
    renderForm()

    await fillAll()
    await userEvent.click(checkButton('email'))
    await userEvent.click(checkButton('nickname'))
    await screen.findByText('이미 사용 중인 이메일입니다')

    expect(submitButton()).toBeDisabled()
  })

  it('이미 쓰는 닉네임이면 확인을 해도 가입할 수 없다', async () => {
    nicknameCheck.mockResolvedValue(false)
    renderForm()

    await fillAll()
    await userEvent.click(checkButton('email'))
    await userEvent.click(checkButton('nickname'))
    await screen.findByText('이미 사용 중인 닉네임입니다')

    expect(submitButton()).toBeDisabled()
  })

  it('닉네임 끝 글자를 지우면 다시 잠기고 안내가 되돌아간다', async () => {
    renderForm()

    await fillAll()
    await passBothChecks()
    await userEvent.type(screen.getByLabelText('닉네임'), '{backspace}')

    expect(submitButton()).toBeDisabled()
    expect(
      screen.queryByText('사용할 수 있는 닉네임입니다'),
    ).not.toBeInTheDocument()
    expect(screen.getByText('[중복 확인] 을 눌러주세요')).toBeInTheDocument()
    expect(screen.getByText('사용할 수 있는 이메일입니다')).toBeInTheDocument()
  })

  it('이메일에 글자를 더하면 다시 잠기고 안내가 되돌아간다', async () => {
    renderForm()

    await fillAll()
    await passBothChecks()
    await userEvent.type(screen.getByLabelText('이메일 아이디'), 'x')

    expect(submitButton()).toBeDisabled()
    expect(
      screen.queryByText('사용할 수 있는 이메일입니다'),
    ).not.toBeInTheDocument()
    expect(screen.getByText('[중복 확인] 을 눌러주세요')).toBeInTheDocument()
    expect(screen.getByText('사용할 수 있는 닉네임입니다')).toBeInTheDocument()
  })
})

describe('SignupForm 가입 시점 409', () => {
  it('서버가 이메일 중복이라 하면 이메일 칸이 뒤집히고 다시 잠긴다', async () => {
    conflict('AUTH_EMAIL_ALREADY_EXISTS', '이미 사용 중인 이메일입니다.')
    renderForm()

    await fillAll()
    await passBothChecks()
    await userEvent.click(submitButton())

    await screen.findByRole('alert')
    expect(screen.getByLabelText('이메일 아이디')).toHaveAttribute(
      'aria-invalid',
      'true',
    )
    expect(submitButton()).toBeDisabled()
    expect(screen.getByLabelText('닉네임')).not.toHaveAttribute('aria-invalid')
  })

  it('서버가 닉네임 중복이라 하면 닉네임 칸이 뒤집히고 다시 잠긴다', async () => {
    conflict('AUTH_NICKNAME_ALREADY_EXISTS', '이미 사용 중인 닉네임입니다.')
    renderForm()

    await fillAll()
    await passBothChecks()
    await userEvent.click(submitButton())

    await screen.findByRole('alert')
    expect(screen.getByLabelText('닉네임')).toHaveAttribute(
      'aria-invalid',
      'true',
    )
    expect(submitButton()).toBeDisabled()
    expect(screen.getByLabelText('이메일 아이디')).not.toHaveAttribute(
      'aria-invalid',
    )
  })

  it('뒤집힌 뒤 이메일을 고쳐 다시 확인하면 풀린다', async () => {
    conflict('AUTH_EMAIL_ALREADY_EXISTS', '이미 사용 중인 이메일입니다.')
    renderForm()

    await fillAll()
    await passBothChecks()
    await userEvent.click(submitButton())
    await screen.findByRole('alert')

    await userEvent.type(screen.getByLabelText('이메일 아이디'), 'x')
    await userEvent.click(checkButton('email'))
    await screen.findByText('사용할 수 있는 이메일입니다')

    expect(submitButton()).toBeEnabled()
  })
})
