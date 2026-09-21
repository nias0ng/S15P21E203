import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

import { SignupForm } from './SignupForm'

/* 서버와 주고받는 부분은 이 테스트의 관심사가 아닙니다 */
vi.mock('../api', () => ({
  signup: vi.fn(),
  checkEmailAvailability: vi.fn(async () => true),
  checkNicknameAvailability: vi.fn(async () => true),
}))

const renderForm = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <SignupForm />
      </MemoryRouter>
    </QueryClientProvider>,
  )

const fillExceptDomain = async () => {
  await userEvent.type(screen.getByLabelText('이메일 아이디'), 'hyanghae')
  await userEvent.type(screen.getByLabelText('비밀번호'), 'password1234')
  await userEvent.type(screen.getByLabelText('비밀번호 확인'), 'password1234')
  await userEvent.type(screen.getByLabelText('닉네임'), '향해테스터')
}

describe('SignupForm 이메일 도메인', () => {
  // 반쪽짜리 주소로 [가입하기] 가 켜지면 누른 뒤에야 서버에서 막힙니다
  it('도메인을 고르기 전에는 가입할 수 없다', async () => {
    renderForm()

    await fillExceptDomain()

    expect(screen.getByRole('button', { name: '가입하기' })).toBeDisabled()
  })

  it('도메인까지 고르면 가입할 수 있다', async () => {
    renderForm()

    await fillExceptDomain()
    await userEvent.selectOptions(
      screen.getByLabelText('이메일 도메인'),
      'naver.com',
    )

    expect(screen.getByRole('button', { name: '가입하기' })).toBeEnabled()
  })

  it('도메인을 고르기 전에는 이메일 중복 확인도 누를 수 없다', async () => {
    renderForm()

    await fillExceptDomain()

    const [emailCheck] = screen.getAllByRole('button', { name: '중복 확인' })
    expect(emailCheck).toBeDisabled()
  })
})
