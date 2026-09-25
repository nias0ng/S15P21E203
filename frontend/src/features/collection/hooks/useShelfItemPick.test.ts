import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { useShelfItemPick } from './useShelfItemPick'

describe('useShelfItemPick', () => {
  it('누르면 넣고, 다시 누르면 뺀다', () => {
    const { result } = renderHook(() => useShelfItemPick(true))

    act(() => result.current.toggle(3))
    act(() => result.current.toggle(5))
    act(() => result.current.toggle(3))

    expect(result.current.picked).toEqual([5])
  })

  it('닫았다 다시 열면 고른 것과 검색어가 비어 있다', () => {
    const { result, rerender } = renderHook(
      ({ open }) => useShelfItemPick(open),
      { initialProps: { open: true } },
    )
    act(() => {
      result.current.toggle(3)
      result.current.setKeyword('상탈')
    })

    rerender({ open: false })
    rerender({ open: true })

    expect(result.current.picked).toEqual([])
    expect(result.current.keyword).toBe('')
  })
})
