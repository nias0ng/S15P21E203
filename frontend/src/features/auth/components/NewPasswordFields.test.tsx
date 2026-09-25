import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { useNewPassword } from '../hooks/useNewPassword'

import { NewPasswordFields } from './NewPasswordFields'

function Harness() {
  const password = useNewPassword()
  return (
    <>
      <NewPasswordFields label="새 비밀번호" password={password} />
      <button type="button" disabled={!password.valid}>
        변경
      </button>
    </>
  )
}

describe('NewPasswordFields', () => {
  it('짧은 비밀번호는 길이 안내를 띄우고 보낼 수 없다', async () => {
    render(<Harness />)

    await userEvent.type(screen.getByLabelText('새 비밀번호'), 'short')

    expect(
      screen.getByText('비밀번호는 8자 이상이어야 합니다'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '변경' })).toBeDisabled()
  })

  it('확인란이 다르면 알리고, 같아지면 보낼 수 있다', async () => {
    render(<Harness />)

    await userEvent.type(screen.getByLabelText('새 비밀번호'), 'password1234')
    await userEvent.type(screen.getByLabelText('새 비밀번호 확인'), 'password')
    expect(screen.getByText('비밀번호가 서로 다릅니다')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '변경' })).toBeDisabled()

    await userEvent.type(screen.getByLabelText('새 비밀번호 확인'), '1234')
    expect(screen.queryByText('비밀번호가 서로 다릅니다')).toBeNull()
    expect(screen.getByRole('button', { name: '변경' })).toBeEnabled()
  })
})
