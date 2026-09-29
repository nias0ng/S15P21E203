import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/shared/api/http'

import { withdraw } from '../api'
import { authKeys } from '../queries'
import type { UserResponse } from '../types'

import { WithdrawModal } from './WithdrawModal'

vi.mock('../api', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  withdraw: vi.fn(),
}))

const withdrawCall = vi.mocked(withdraw)

const account = (hasPassword: boolean): UserResponse => ({
  userId: 1,
  email: 'sailor@gmail.com',
  nickname: '향해자',
  profileImageUrl: null,
  hasPassword,
  googleConnected: !hasPassword,
})

beforeEach(() => {
  vi.resetAllMocks()
})

// `me` 를 비우면 내 정보를 아직 못 받은 상태입니다.
const renderModal = (me: UserResponse | null = account(true)) => {
  const client = new QueryClient()
  if (me !== null) {
    client.setQueryData(authKeys.me(), me)
  }
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <WithdrawModal open onClose={() => {}} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const withdrawButton = () => screen.getByRole('button', { name: '탈퇴' })
const confirmNotice = () =>
  userEvent.click(
    screen.getByRole('checkbox', { name: '위 내용을 확인했습니다' }),
  )

describe('WithdrawModal', () => {
  it('안내 확인과 비밀번호를 모두 채워야 탈퇴할 수 있다', async () => {
    renderModal()

    expect(withdrawButton()).toBeDisabled()

    await confirmNotice()
    expect(withdrawButton()).toBeDisabled()

    await userEvent.type(screen.getByLabelText('현재 비밀번호'), 'password1234')
    expect(withdrawButton()).toBeEnabled()
  })

  it('비밀번호만 채우고 확인을 안 하면 탈퇴할 수 없다', async () => {
    renderModal()

    await userEvent.type(screen.getByLabelText('현재 비밀번호'), 'password1234')

    expect(withdrawButton()).toBeDisabled()
  })

  it('Google 로 가입한 계정은 비밀번호 대신 Google 로 본인 확인을 한다', () => {
    renderModal(account(false))

    expect(screen.queryByLabelText('현재 비밀번호')).not.toBeInTheDocument()
    // 테스트에는 Google 로그인이 꺼져 있어 버튼 대신 안내가 나옵니다.
    expect(
      screen.getByText(/Google 로 본인 확인을 할 수 없어/),
    ).toBeInTheDocument()
    expect(withdrawButton()).toBeDisabled()
  })

  // 짐작으로 비밀번호 칸을 띄우면 Google 계정인 사람이 아무 값이나 넣고 탈퇴를 누르게 됩니다.
  it('내 정보를 받기 전에는 비밀번호 칸을 띄우지 않고 탈퇴도 잠가 둔다', async () => {
    renderModal(null)

    expect(
      screen.getByText('계정 정보를 확인하고 있습니다.'),
    ).toBeInTheDocument()
    expect(screen.queryByLabelText('현재 비밀번호')).not.toBeInTheDocument()
    await confirmNotice()
    expect(withdrawButton()).toBeDisabled()
  })

  it('서버가 Google 재확인이 필요하다고 하면 비밀번호 칸 대신 Google 확인으로 바꾼다', async () => {
    withdrawCall.mockRejectedValueOnce(
      new ApiError(
        400,
        'AUTH_GOOGLE_REAUTH_REQUIRED',
        '탈퇴하려면 Google 계정으로 한 번 더 확인해 주세요.',
      ),
    )
    renderModal()

    await confirmNotice()
    await userEvent.type(screen.getByLabelText('현재 비밀번호'), 'anything')
    await userEvent.click(withdrawButton())

    await screen.findByText(/Google 로 본인 확인을 할 수 없어/)
    expect(screen.queryByLabelText('현재 비밀번호')).not.toBeInTheDocument()
    expect(withdrawButton()).toBeDisabled()
  })

  it('후기는 삭제되지 않고 남는다고 안내한다', () => {
    renderModal()

    expect(
      screen.getByText(/작성자 표시만 지워지고 남습니다/),
    ).toBeInTheDocument()
  })
})
