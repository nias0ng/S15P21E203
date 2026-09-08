import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { WithdrawModal } from './WithdrawModal'

describe('WithdrawModal', () => {
  it('안내 확인과 비밀번호를 모두 채워야 탈퇴할 수 있다', async () => {
    render(<WithdrawModal open onClose={() => {}} />)

    const withdraw = screen.getByRole('button', { name: '탈퇴' })
    expect(withdraw).toBeDisabled()

    // 확인만 해도 아직 안 됩니다
    await userEvent.click(
      screen.getByRole('checkbox', { name: '위 내용을 확인했습니다' }),
    )
    expect(withdraw).toBeDisabled()

    await userEvent.type(screen.getByLabelText('현재 비밀번호'), 'password1234')
    expect(withdraw).toBeEnabled()
  })

  it('비밀번호만 채우고 확인을 안 하면 탈퇴할 수 없다', async () => {
    render(<WithdrawModal open onClose={() => {}} />)

    await userEvent.type(screen.getByLabelText('현재 비밀번호'), 'password1234')

    expect(screen.getByRole('button', { name: '탈퇴' })).toBeDisabled()
  })

  it('후기는 삭제되지 않고 남는다고 안내한다', () => {
    // 확정된 정책은 후기를 익명화해 유지하는 것입니다.
    // 안내 문구가 실제 동작과 어긋나면 사용자가 잘못 판단합니다.
    render(<WithdrawModal open onClose={() => {}} />)

    expect(
      screen.getByText(/작성자 표시만 지워지고 남습니다/),
    ).toBeInTheDocument()
  })
})
