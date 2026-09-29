import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/shared/api/http'

import {
  checkNicknameAvailability,
  confirmEmailVerification,
  requestEmailVerification,
  signup,
} from '../api'
import type {
  EmailVerificationConfirmResponse,
  EmailVerificationSendResponse,
} from '../types'

import { SignupForm } from './SignupForm'

vi.mock('../api', () => ({
  signup: vi.fn(),
  checkNicknameAvailability: vi.fn(),
  requestEmailVerification: vi.fn(),
  confirmEmailVerification: vi.fn(),
}))

const nicknameCheck = vi.mocked(checkNicknameAvailability)
const sendCall = vi.mocked(requestEmailVerification)
const confirmCall = vi.mocked(confirmEmailVerification)
const signupCall = vi.mocked(signup)

const EMAIL = 'hyanghae@naver.com'
const TOKEN = 'verified-token'

beforeEach(() => {
  vi.resetAllMocks()
  nicknameCheck.mockResolvedValue(true)
  sendCall.mockResolvedValue({
    expiresInSeconds: 300,
    resendAvailableInSeconds: 60,
  })
  confirmCall.mockResolvedValue({
    verificationToken: TOKEN,
    expiresInSeconds: 1800,
  })
})

afterEach(() => {
  vi.useRealTimers()
})

/**
 * 카운트다운이 쓰는 것만 가짜로 둡니다. setTimeout 까지 가짜면 react-query 알림과
 * findBy 의 기다림이 멈춥니다.
 */
const fakeCountdownClock = () =>
  vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] })

const passSeconds = (seconds: number) =>
  act(() => {
    vi.advanceTimersByTime(seconds * 1000)
  })

const rejectWith = (
  mock: typeof sendCall | typeof confirmCall | typeof signupCall,
  status: number,
  code: string,
  message: string,
) => mock.mockRejectedValueOnce(new ApiError(status, code, message))

/** 응답이 오는 때를 테스트가 정합니다. 늦게 온 응답을 흉내 낼 때 씁니다 */
const deferred = <T,>() => {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((settle) => {
    resolve = settle
  })
  return { promise, resolve }
}

const SEND_RESPONSE: EmailVerificationSendResponse = {
  expiresInSeconds: 300,
  resendAvailableInSeconds: 60,
}

const CONFIRM_RESPONSE: EmailVerificationConfirmResponse = {
  verificationToken: TOKEN,
  expiresInSeconds: 1800,
}

const renderForm = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <SignupForm />
      </MemoryRouter>
    </QueryClientProvider>,
  )

const submitButton = () => screen.getByRole('button', { name: '가입하기' })
const sendButton = () => screen.getByRole('button', { name: '인증하기' })
const resendButton = () => screen.getByRole('button', { name: '재인증' })
const confirmButton = () => screen.getByRole('button', { name: '확인' })
const nicknameCheckButton = () =>
  screen.getByRole('button', { name: '중복 확인' })
const codeInput = () => screen.getByLabelText('인증번호')
const timer = (remaining: string) =>
  screen.getByRole('timer', { name: `남은 시간 ${remaining}` })

const fillExceptDomain = async () => {
  await userEvent.type(screen.getByLabelText('이메일 아이디'), 'hyanghae')
  await userEvent.type(screen.getByLabelText('비밀번호'), 'password1234')
  await userEvent.type(screen.getByLabelText('비밀번호 재입력'), 'password1234')
  await userEvent.type(screen.getByLabelText('닉네임'), '향해테스터')
}

const fillAll = async () => {
  await fillExceptDomain()
  await userEvent.selectOptions(
    screen.getByLabelText('이메일 도메인'),
    'naver.com',
  )
}

const sendCode = async () => {
  await userEvent.click(sendButton())
  await screen.findByLabelText('인증번호')
}

const verifyEmail = async () => {
  await sendCode()
  await userEvent.type(codeInput(), '0123456')
  await userEvent.click(confirmButton())
  await screen.findByText('인증되었습니다')
}

const passNicknameCheck = async () => {
  await userEvent.click(nicknameCheckButton())
  await screen.findByText('사용할 수 있는 닉네임입니다')
}

describe('SignupForm 이메일 도메인', () => {
  it('도메인을 고르기 전에는 가입할 수 없다', async () => {
    renderForm()

    await fillExceptDomain()

    expect(submitButton()).toBeDisabled()
  })

  it('도메인을 고르기 전에는 인증번호도 받을 수 없다', async () => {
    renderForm()

    await fillExceptDomain()

    expect(sendButton()).toBeDisabled()
  })
})

describe('SignupForm 이메일 인증', () => {
  it('인증하지 않으면 닉네임을 확인해도 가입할 수 없다', async () => {
    renderForm()

    await fillAll()
    await passNicknameCheck()

    expect(submitButton()).toBeDisabled()
  })

  it('번호를 받기만 하고 확인하지 않으면 가입할 수 없다', async () => {
    renderForm()

    await fillAll()
    await passNicknameCheck()
    await sendCode()

    expect(sendCall).toHaveBeenCalledWith(EMAIL)
    expect(submitButton()).toBeDisabled()
  })

  it('번호를 확인하면 가입 요청에 인증 토큰이 실린다', async () => {
    signupCall.mockResolvedValue({
      userId: 1,
      email: EMAIL,
      nickname: '향해테스터',
      profileImageUrl: null,
      hasPassword: true,
      googleConnected: false,
    })
    renderForm()

    await fillAll()
    await passNicknameCheck()
    await verifyEmail()

    expect(confirmCall).toHaveBeenCalledWith({
      email: EMAIL,
      code: '0123456',
    })
    expect(screen.queryByLabelText('인증번호')).not.toBeInTheDocument()
    expect(sendButton()).toBeDisabled()

    await userEvent.click(submitButton())

    expect(signupCall).toHaveBeenCalledWith({
      email: EMAIL,
      password: 'password1234',
      nickname: '향해테스터',
      emailVerificationToken: TOKEN,
    })
  })

  it('보냈다는 안내는 이메일이 아니라 번호 칸 아래에 뜬다', async () => {
    renderForm()

    await fillAll()
    await sendCode()

    expect(codeInput()).toHaveAccessibleDescription(
      '인증번호를 보냈습니다. 메일함을 확인해주세요',
    )
    expect(
      screen.getByLabelText('이메일 아이디'),
    ).not.toHaveAccessibleDescription()
  })

  it('번호 칸은 숫자만 일곱 자리까지 받는다', async () => {
    renderForm()

    await fillAll()
    await sendCode()
    await userEvent.type(codeInput(), '01a2-34567899')

    expect(codeInput()).toHaveValue('0123456')
    expect(codeInput()).toHaveAttribute('inputmode', 'numeric')
    expect(codeInput()).toHaveAttribute('autocomplete', 'one-time-code')
  })

  it('일곱 자리를 다 넣어야 확인할 수 있다', async () => {
    renderForm()

    await fillAll()
    await sendCode()
    await userEvent.type(codeInput(), '123456')

    expect(confirmButton()).toBeDisabled()

    await userEvent.type(codeInput(), '7')

    expect(confirmButton()).toBeEnabled()
  })

  it('인증 뒤 이메일을 고치면 인증이 풀리고 처음부터 다시 받아야 한다', async () => {
    renderForm()

    await fillAll()
    await passNicknameCheck()
    await verifyEmail()
    await userEvent.type(screen.getByLabelText('이메일 아이디'), 'x')

    expect(submitButton()).toBeDisabled()
    expect(screen.queryByText('인증되었습니다')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('인증번호')).not.toBeInTheDocument()
    expect(sendButton()).toBeEnabled()
    expect(screen.getByText('[인증하기] 를 눌러주세요')).toBeInTheDocument()
  })

  it('번호를 받은 뒤 이메일을 고치면 번호 칸이 사라진다', async () => {
    renderForm()

    await fillAll()
    await sendCode()
    await userEvent.type(codeInput(), '1234')
    await userEvent.selectOptions(
      screen.getByLabelText('이메일 도메인'),
      'gmail.com',
    )

    expect(screen.queryByLabelText('인증번호')).not.toBeInTheDocument()
    expect(sendButton()).toBeEnabled()
  })

  it('이미 가입된 이메일이면 번호 칸 없이 중복 안내를 띄운다', async () => {
    rejectWith(sendCall, 409, 'AUTH_EMAIL_ALREADY_EXISTS', '이미 가입된 이메일')
    renderForm()

    await fillAll()
    await userEvent.click(sendButton())

    expect(
      await screen.findByText('이미 사용 중인 메일입니다.'),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('이메일 아이디')).toHaveAttribute(
      'aria-invalid',
      'true',
    )
    expect(screen.queryByLabelText('인증번호')).not.toBeInTheDocument()
  })

  it('보내기 제한에 걸리면 서버 문구를 그대로 띄운다', async () => {
    rejectWith(
      sendCall,
      429,
      'AUTH_EMAIL_VERIFICATION_SEND_LIMIT_EXCEEDED',
      '인증번호 요청 횟수를 넘었습니다.',
    )
    renderForm()

    await fillAll()
    await userEvent.click(sendButton())

    expect(
      await screen.findByText('인증번호 요청 횟수를 넘었습니다.'),
    ).toBeInTheDocument()
  })

  it('번호가 틀리면 안내하고 가입은 잠겨 있다', async () => {
    rejectWith(
      confirmCall,
      400,
      'AUTH_EMAIL_VERIFICATION_CODE_MISMATCH',
      '인증번호가 일치하지 않습니다.',
    )
    renderForm()

    await fillAll()
    await passNicknameCheck()
    await sendCode()
    await userEvent.type(codeInput(), '1111111')
    await userEvent.click(confirmButton())

    expect(
      await screen.findByText('인증번호가 올바르지 않습니다'),
    ).toBeInTheDocument()
    expect(codeInput()).toBeEnabled()
    expect(submitButton()).toBeDisabled()
  })

  it('다섯 번 틀려 번호가 폐기되면 [확인] 이 [재인증] 으로 바뀐다', async () => {
    fakeCountdownClock()
    rejectWith(
      confirmCall,
      429,
      'AUTH_EMAIL_VERIFICATION_TOO_MANY_ATTEMPTS',
      '인증번호를 너무 많이 틀렸습니다.',
    )
    renderForm()

    await fillAll()
    await sendCode()
    await userEvent.type(codeInput(), '1111111')
    await userEvent.click(confirmButton())

    expect(
      await screen.findByText(
        '인증번호를 너무 많이 틀렸습니다. [재인증] 을 눌러 인증번호를 다시 받아주세요',
      ),
    ).toBeInTheDocument()
    expect(codeInput()).toBeDisabled()
    expect(screen.queryByRole('button', { name: '확인' })).toBeNull()
    // 보낸 지 1분이 안 됐으면 서버가 다시 보내 주지 않습니다
    expect(resendButton()).toBeDisabled()

    passSeconds(60)
    expect(resendButton()).toBeEnabled()
  })
})

describe('SignupForm 늦게 온 응답', () => {
  const switchDomain = () =>
    userEvent.selectOptions(screen.getByLabelText('이메일 도메인'), 'gmail.com')

  it('옛 주소로 보낸 응답이 늦게 와도 새 주소의 번호 칸을 지우지 않는다', async () => {
    const lateSend = deferred<EmailVerificationSendResponse>()
    sendCall.mockReturnValueOnce(lateSend.promise)
    renderForm()

    await fillAll()
    await userEvent.click(sendButton())
    await switchDomain()
    await sendCode()
    await userEvent.type(codeInput(), '1234')

    await act(async () => {
      lateSend.resolve(SEND_RESPONSE)
      await lateSend.promise
    })

    expect(sendCall).toHaveBeenLastCalledWith('hyanghae@gmail.com')
    expect(codeInput()).toHaveValue('1234')
    expect(codeInput()).toBeEnabled()
  })

  it('옛 주소의 확인 응답이 늦게 와도 새 주소의 번호 칸을 잠그지 않는다', async () => {
    const lateConfirm = deferred<EmailVerificationConfirmResponse>()
    confirmCall.mockReturnValueOnce(lateConfirm.promise)
    renderForm()

    await fillAll()
    await sendCode()
    await userEvent.type(codeInput(), '0123456')
    await userEvent.click(confirmButton())
    await switchDomain()
    await sendCode()

    await act(async () => {
      lateConfirm.resolve(CONFIRM_RESPONSE)
      await lateConfirm.promise
    })

    expect(screen.queryByText('인증되었습니다')).not.toBeInTheDocument()
    expect(codeInput()).toBeEnabled()
    expect(timer('05:00')).toBeInTheDocument()
  })
})

describe('SignupForm 인증번호 타이머', () => {
  it('05:00 에서 00:00 을 향해 줄어든다', async () => {
    fakeCountdownClock()
    renderForm()

    await fillAll()
    await sendCode()

    expect(timer('05:00')).toHaveTextContent('05:00')

    passSeconds(1)
    expect(timer('04:59')).toBeInTheDocument()

    passSeconds(60)
    expect(timer('03:59')).toBeInTheDocument()
  })

  it('번호가 살아 있는 동안에는 다시 받을 수 없다', async () => {
    fakeCountdownClock()
    renderForm()

    await fillAll()
    await sendCode()
    passSeconds(299)

    expect(sendButton()).toBeDisabled()
    expect(screen.queryByRole('button', { name: '재인증' })).toBeNull()
    expect(confirmButton()).toBeInTheDocument()
  })

  it('시간이 다 되면 [확인] 이 [재인증] 으로 바뀐다', async () => {
    fakeCountdownClock()
    renderForm()

    await fillAll()
    await sendCode()
    await userEvent.type(codeInput(), '1234567')

    passSeconds(300)

    expect(timer('00:00')).toBeInTheDocument()
    expect(
      screen.getByText(
        '인증 시간이 지났습니다. [재인증] 을 눌러 다시 받아주세요',
      ),
    ).toBeInTheDocument()
    expect(codeInput()).toBeDisabled()
    expect(screen.queryByRole('button', { name: '확인' })).toBeNull()
    expect(resendButton()).toBeEnabled()
  })

  it('[재인증] 을 누르면 메일을 다시 보내고 05:00 부터 다시 센다', async () => {
    fakeCountdownClock()
    renderForm()

    await fillAll()
    await sendCode()
    await userEvent.type(codeInput(), '1234')
    passSeconds(300)
    await userEvent.click(resendButton())

    await screen.findByRole('timer', { name: '남은 시간 05:00' })
    expect(sendCall).toHaveBeenCalledTimes(2)
    expect(sendCall).toHaveBeenLastCalledWith(EMAIL)
    expect(codeInput()).toHaveValue('')
    expect(codeInput()).toBeEnabled()
    expect(confirmButton()).toBeInTheDocument()
  })
})

describe('SignupForm 가입 시점 오류', () => {
  it('서버가 인증 토큰을 받지 않으면 인증을 풀고 서버 문구를 띄운다', async () => {
    rejectWith(
      signupCall,
      400,
      'AUTH_EMAIL_NOT_VERIFIED',
      '이메일 인증이 필요합니다.',
    )
    renderForm()

    await fillAll()
    await passNicknameCheck()
    await verifyEmail()
    await userEvent.click(submitButton())

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '이메일 인증이 필요합니다.',
    )
    expect(screen.queryByText('인증되었습니다')).not.toBeInTheDocument()
    expect(sendButton()).toBeEnabled()
    expect(submitButton()).toBeDisabled()
  })

  it('서버가 닉네임 중복이라 하면 닉네임 칸이 뒤집히고 인증은 남는다', async () => {
    rejectWith(
      signupCall,
      409,
      'AUTH_NICKNAME_ALREADY_EXISTS',
      '이미 사용 중인 닉네임입니다.',
    )
    renderForm()

    await fillAll()
    await passNicknameCheck()
    await verifyEmail()
    await userEvent.click(submitButton())

    await screen.findByRole('alert')
    expect(screen.getByLabelText('닉네임')).toHaveAttribute(
      'aria-invalid',
      'true',
    )
    expect(submitButton()).toBeDisabled()
    expect(screen.getByText('인증되었습니다')).toBeInTheDocument()
  })

  it('닉네임을 고쳐 다시 확인하면 같은 인증으로 다시 가입할 수 있다', async () => {
    rejectWith(
      signupCall,
      409,
      'AUTH_NICKNAME_ALREADY_EXISTS',
      '이미 사용 중인 닉네임입니다.',
    )
    renderForm()

    await fillAll()
    await passNicknameCheck()
    await verifyEmail()
    await userEvent.click(submitButton())
    await screen.findByRole('alert')

    await userEvent.type(screen.getByLabelText('닉네임'), '2')
    await passNicknameCheck()

    expect(submitButton()).toBeEnabled()
  })
})

describe('SignupForm 닉네임 중복 확인', () => {
  it('닉네임 끝 글자를 지우면 다시 잠기고 안내가 되돌아간다', async () => {
    renderForm()

    await fillAll()
    await passNicknameCheck()
    await verifyEmail()
    await userEvent.type(screen.getByLabelText('닉네임'), '{backspace}')

    expect(submitButton()).toBeDisabled()
    expect(
      screen.queryByText('사용할 수 있는 닉네임입니다'),
    ).not.toBeInTheDocument()
    expect(screen.getByText('[중복 확인] 을 눌러주세요')).toBeInTheDocument()
    expect(screen.getByText('인증되었습니다')).toBeInTheDocument()
  })

  it('이미 쓰는 닉네임이면 확인을 해도 가입할 수 없다', async () => {
    nicknameCheck.mockResolvedValue(false)
    renderForm()

    await fillAll()
    await verifyEmail()
    await userEvent.click(nicknameCheckButton())
    await screen.findByText('이미 사용 중인 닉네임입니다')

    expect(submitButton()).toBeDisabled()
  })
})
