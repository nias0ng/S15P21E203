import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

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

  /*
    세 칸이 서로의 값을 조합해 바깥에 알립니다. **바뀐 칸은 이벤트에서, 나머지 둘은
    지금 렌더의 값에서** 가져오는데, 이것이 한 박자 늦지 않는지를 봅니다.

    늦지 않는 이유는 둘입니다. 바뀐 칸의 값은 `event.target.value` 라 DOM 이 들고
    있는 지금 값이고, 나머지 둘은 **같은 이벤트에서 함께 바뀔 수 없는 다른 칸**이라
    지난 렌더의 값이 곧 현재 값입니다. 빨리 쳐도 입력 하나하나가 따로 처리됩니다.

    이 시험은 그 전제를 붙잡아 둡니다 — `useEffect` 로 옮기자는 이야기가 나오면
    여기가 왜 그대로여도 되는지의 근거입니다(그렇게 옮기면 렌더가 한 번 더 돌고
    처음 켤 때도 빈 값을 한 번 알리게 됩니다).
  */
  it('빨리 이어 쳐도 알리는 주소가 한 박자 늦지 않는다', async () => {
    const onChange = vi.fn()
    render(<EmailField onChange={onChange} />)

    await userEvent.type(screen.getByLabelText('이메일 아이디'), 'hyanghae')
    await userEvent.selectOptions(
      screen.getByLabelText('이메일 도메인'),
      'naver.com',
    )
    // 도메인을 고른 뒤에 아이디를 더 칩니다 — 먼저 고른 값을 흘리면 여기서 드러납니다
    await userEvent.type(screen.getByLabelText('이메일 아이디'), '99')

    expect(onChange).toHaveBeenLastCalledWith('hyanghae99@naver.com')

    /*
      한 번이라도 어긋난 조합을 알린 적이 없어야 합니다. 도메인을 고르기 전에는
      빈 문자열이고, 고른 뒤에는 그때그때의 아이디에 도메인이 붙은 값입니다.
    */
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

    // 목록으로 되돌리면 직접 적어 둔 값이 아니라 고른 값이 붙습니다
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
