import { act, renderHook } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { useResetOnOpen } from './useResetOnOpen'

const setup = (initialKey: string | null) => {
  const reset = vi.fn()
  const view = renderHook(({ key }) => useResetOnOpen(key, reset), {
    initialProps: { key: initialKey },
  })
  return { reset, rerender: (key: string | null) => view.rerender({ key }) }
}

describe('useResetOnOpen', () => {
  it('닫힌 채로 그려지는 동안에는 되돌리지 않는다', () => {
    const { reset, rerender } = setup(null)

    rerender(null)

    expect(reset).not.toHaveBeenCalled()
  })

  it('열린 채로 처음 그려지면 한 번 되돌린다', () => {
    const { reset } = setup('a')

    expect(reset).toHaveBeenCalledTimes(1)
  })

  it('같은 key 로 다시 그려질 때는 되돌리지 않는다', () => {
    const { reset, rerender } = setup(null)

    rerender('a')
    rerender('a')

    expect(reset).toHaveBeenCalledTimes(1)
  })

  it('열린 채로 key 가 바뀌면 다시 되돌린다', () => {
    const { reset, rerender } = setup('a')

    rerender('b')

    expect(reset).toHaveBeenCalledTimes(2)
  })

  it('닫을 때 한 번, 다시 열 때 한 번 되돌린다', () => {
    const { reset, rerender } = setup('a')

    rerender(null)
    rerender(null)
    expect(reset).toHaveBeenCalledTimes(2)

    rerender('a')
    expect(reset).toHaveBeenCalledTimes(3)
  })

  it('다시 열면 적던 값이 처음 값으로 돌아가 있다', () => {
    const { result, rerender } = renderHook(
      ({ open }) => {
        const [value, setValue] = useState('')
        useResetOnOpen(open ? 'open' : null, () => setValue('처음'))
        return { value, setValue }
      },
      { initialProps: { open: true } },
    )
    act(() => result.current.setValue('적던 값'))

    rerender({ open: false })
    rerender({ open: true })

    expect(result.current.value).toBe('처음')
  })
})
