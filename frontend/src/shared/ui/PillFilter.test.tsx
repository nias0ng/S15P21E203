import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { PillFilter } from './PillFilter'

const OPTIONS = [
  { value: 'NAME_EN', label: 'abc 순' },
  { value: 'NAME_KO', label: '가나다순' },
] as const

describe('PillFilter', () => {
  it('고른 것을 aria-pressed 로 알린다', () => {
    render(
      <PillFilter
        label="정렬"
        options={OPTIONS}
        value="NAME_EN"
        onChange={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: 'abc 순' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: '가나다순' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  it('안 고른 것을 누르면 그 값을 알린다', async () => {
    const onChange = vi.fn()
    render(
      <PillFilter
        label="정렬"
        options={OPTIONS}
        value="NAME_EN"
        onChange={onChange}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: '가나다순' }))

    expect(onChange).toHaveBeenCalledWith('NAME_KO')
  })

  /* 향수의 성별 · 인기 필터는 "고르지 않음" 으로 돌아갈 수 있어야 합니다 */
  it('켜진 것을 다시 누르면 해제된다', async () => {
    const onChange = vi.fn()
    render(
      <PillFilter
        label="정렬"
        options={OPTIONS}
        value="NAME_EN"
        onChange={onChange}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: 'abc 순' }))

    expect(onChange).toHaveBeenCalledWith(null)
  })

  /* 정렬처럼 늘 하나가 켜져 있어야 하는 묶음입니다 — 꺼지면 기준이 없어집니다 */
  it('required 면 켜진 것을 다시 눌러도 해제되지 않는다', async () => {
    const onChange = vi.fn()
    render(
      <PillFilter
        label="정렬"
        options={OPTIONS}
        value="NAME_EN"
        onChange={onChange}
        required
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: 'abc 순' }))

    expect(onChange).not.toHaveBeenCalled()
  })

  it('required 여도 다른 것으로는 바꿀 수 있다', async () => {
    const onChange = vi.fn()
    render(
      <PillFilter
        label="정렬"
        options={OPTIONS}
        value="NAME_EN"
        onChange={onChange}
        required
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: '가나다순' }))

    expect(onChange).toHaveBeenCalledWith('NAME_KO')
  })
})
