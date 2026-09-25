import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { EmailField } from './EmailField'

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

  it('빨리 이어 쳐도 알리는 주소가 한 박자 늦지 않는다', async () => {
    const onChange = vi.fn()
    render(<EmailField onChange={onChange} />)

    await userEvent.type(screen.getByLabelText('이메일 아이디'), 'hyanghae')
    await userEvent.selectOptions(
      screen.getByLabelText('이메일 도메인'),
      'naver.com',
    )
    await userEvent.type(screen.getByLabelText('이메일 아이디'), '99')

    expect(onChange).toHaveBeenLastCalledWith('hyanghae99@naver.com')

    const reported = onChange.mock.calls.map(([value]) => value as string)
    const joined = reported.filter((value) => value !== '')

    expect(joined).toEqual([
      'hyanghae@naver.com',
      'hyanghae9@naver.com',
      'hyanghae99@naver.com',
    ])
  })

  it('직접입력에서 도메인을 고쳐도 아이디가 흐트러지지 않는다', async () => {
    const onChange = vi.fn()
    render(<EmailField onChange={onChange} />)

    await userEvent.type(screen.getByLabelText('이메일 아이디'), 'hyanghae')
    await userEvent.selectOptions(
      screen.getByLabelText('이메일 도메인'),
      '직접입력',
    )
    await userEvent.type(screen.getByLabelText('도메인 직접 입력'), 'ssafy.com')

    expect(onChange).toHaveBeenLastCalledWith('hyanghae@ssafy.com')

    await userEvent.selectOptions(
      screen.getByLabelText('이메일 도메인'),
      'gmail.com',
    )

    expect(onChange).toHaveBeenLastCalledWith('hyanghae@gmail.com')
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
