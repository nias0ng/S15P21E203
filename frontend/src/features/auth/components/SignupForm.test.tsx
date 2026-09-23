import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { checkEmailAvailability, checkNicknameAvailability } from '../api'

import { SignupForm } from './SignupForm'

/* 서버와 주고받는 부분은 이 테스트의 관심사가 아닙니다 */
vi.mock('../api', () => ({
  signup: vi.fn(),
  checkEmailAvailability: vi.fn(),
  checkNicknameAvailability: vi.fn(),
}))

const emailCheck = vi.mocked(checkEmailAvailability)
const nicknameCheck = vi.mocked(checkNicknameAvailability)

beforeEach(() => {
  emailCheck.mockResolvedValue(true)
  nicknameCheck.mockResolvedValue(true)
})

const renderForm = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <SignupForm />
      </MemoryRouter>
    </QueryClientProvider>,
  )

const submitButton = () => screen.getByRole('button', { name: '가입하기' })

/** 한 줄에 [중복 확인] 이 둘입니다 — 앞이 이메일, 뒤가 닉네임입니다 */
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

/** 이메일 · 닉네임 [중복 확인] 을 차례로 누르고 답이 붙을 때까지 기다립니다 */
const passBothChecks = async () => {
  await userEvent.click(checkButton('email'))
  await userEvent.click(checkButton('nickname'))
  await screen.findByText('사용할 수 있는 이메일입니다')
  await screen.findByText('사용할 수 있는 닉네임입니다')
}

describe('SignupForm 이메일 도메인', () => {
  // 반쪽짜리 주소로 [가입하기] 가 켜지면 누른 뒤에야 서버에서 막힙니다
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
  // 확인을 건너뛴 가입은 서버가 409 로 막지만, 그때는 비밀번호를 다시 적어야 합니다
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

  // 확인한 값과 보내는 값이 어긋나면 "쓸 수 있다" 는 남의 답입니다
  it('확인을 통과한 뒤 닉네임을 고치면 다시 잠긴다', async () => {
    renderForm()

    await fillAll()
    await passBothChecks()
    await userEvent.type(screen.getByLabelText('닉네임'), '2')

    expect(submitButton()).toBeDisabled()
  })

  it('확인을 통과한 뒤 이메일을 고치면 다시 잠긴다', async () => {
    renderForm()

    await fillAll()
    await passBothChecks()
    await userEvent.type(screen.getByLabelText('이메일 아이디'), 'x')

    expect(submitButton()).toBeDisabled()
  })
})
