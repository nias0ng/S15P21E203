import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'

import { WithdrawModal } from './WithdrawModal'

/** 클라이언트는 테스트마다 새로 만듭니다 — 돌려 쓰면 앞 테스트의 캐시가 넘어옵니다 */
const renderModal = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <WithdrawModal open onClose={() => {}} />
      </MemoryRouter>
    </QueryClientProvider>,
  )

describe('WithdrawModal', () => {
  it('안내 확인과 비밀번호를 모두 채워야 탈퇴할 수 있다', async () => {
    renderModal()

    const withdraw = screen.getByRole('button', { name: '탈퇴' })
    expect(withdraw).toBeDisabled()

    await userEvent.click(
      screen.getByRole('checkbox', { name: '위 내용을 확인했습니다' }),
    )
    expect(withdraw).toBeDisabled()

    await userEvent.type(screen.getByLabelText('현재 비밀번호'), 'password1234')
    expect(withdraw).toBeEnabled()
  })

  it('비밀번호만 채우고 확인을 안 하면 탈퇴할 수 없다', async () => {
    renderModal()

    await userEvent.type(screen.getByLabelText('현재 비밀번호'), 'password1234')

    expect(screen.getByRole('button', { name: '탈퇴' })).toBeDisabled()
  })

  it('후기는 삭제되지 않고 남는다고 안내한다', () => {
    // 확정된 정책은 후기를 익명화해 유지하는 것이라, 안내가 어긋나면 잘못 판단합니다
    renderModal()

    expect(
      screen.getByText(/작성자 표시만 지워지고 남습니다/),
    ).toBeInTheDocument()
  })
})
