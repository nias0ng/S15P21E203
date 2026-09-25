import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Unroll } from './Unroll'

describe('Unroll', () => {
  it('내용을 그린다', () => {
    render(
      <Unroll>
        <p>찾는 말</p>
      </Unroll>,
    )

    expect(screen.getByText('찾는 말')).toBeInTheDocument()
  })

  /* 풀리는 동안 안의 단추로 탭이 들어가면 보이지 않는 자리에 포커스가 섭니다 */
  it('풀리는 동안에는 건너뛰고, 다 풀리면 누를 수 있다', async () => {
    render(
      <Unroll>
        <button type="button">보내기</button>
      </Unroll>,
    )

    const button = screen.getByRole('button', { name: '보내기' })
    expect(button.closest('[inert]')).not.toBeNull()

    await waitFor(() => expect(button.closest('[inert]')).toBeNull())
  })
})
