import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'

import { EmailField } from './EmailField'

/** 이 칸이 바깥에 알려 준 주소를 글자로 드러냅니다 */
function Harness() {
  const [email, setEmail] = useState('')
  return (
    <>
      <EmailField onChange={setEmail} />
      <p>{`알린 주소: "${email}"`}</p>
    </>
  )
}

describe('EmailField', () => {
  it('아이디를 적고 도메인을 고르면 둘을 @ 로 잇는다', async () => {
    render(<Harness />)

    await userEvent.type(screen.getByLabelText('이메일 아이디'), 'hyanghae')
    await userEvent.selectOptions(
      screen.getByLabelText('이메일 도메인'),
      'naver.com',
    )

    expect(screen.getByText('알린 주소: "hyanghae@naver.com"')).toBeVisible()
  })

  it('목록에 없으면 직접입력을 골라 도메인을 적는다', async () => {
    render(<Harness />)

    await userEvent.type(screen.getByLabelText('이메일 아이디'), 'hyanghae')
    await userEvent.selectOptions(
      screen.getByLabelText('이메일 도메인'),
      '직접입력',
    )
    await userEvent.type(screen.getByLabelText('도메인 직접 입력'), 'ssafy.com')

    expect(screen.getByText('알린 주소: "hyanghae@ssafy.com"')).toBeVisible()
  })

  it('바깥에서 받은 사정을 아이디 칸에 붙여 읽어 준다', () => {
    render(
      <EmailField onChange={() => {}} error="이미 사용 중인 이메일입니다" />,
    )

    const local = screen.getByLabelText('이메일 아이디')

    expect(local).toHaveAccessibleDescription('이미 사용 중인 이메일입니다')
    expect(local).toBeInvalid()
  })
})
