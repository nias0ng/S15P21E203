import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { Checkbox } from './Checkbox'

describe('Checkbox', () => {
  it('클릭하면 onChange 가 호출된다', async () => {
    const onChange = vi.fn()
    render(
      <label>
        <Checkbox checked={false} onChange={onChange} />
        전체 동의
      </label>,
    )

    await userEvent.click(screen.getByRole('checkbox', { name: '전체 동의' }))

    expect(onChange).toHaveBeenCalledOnce()
  })

  it('스페이스바로도 토글된다 (기본 input 을 유지했는지 확인)', async () => {
    const onChange = vi.fn()
    render(
      <label>
        <Checkbox checked={false} onChange={onChange} />
        전체 동의
      </label>,
    )

    await userEvent.tab()
    await userEvent.keyboard(' ')

    expect(onChange).toHaveBeenCalledOnce()
  })
})
