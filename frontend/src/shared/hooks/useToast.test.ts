import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { useToast } from './useToast'

describe('useToast', () => {
  it('처음에는 닫혀 있다', () => {
    const { result } = renderHook(() => useToast())

    expect(result.current.toastProps.open).toBe(false)
    expect(result.current.toastProps.message).toBe('')
  })

  it('showToast 로 메시지를 띄운다', () => {
    const { result } = renderHook(() => useToast())

    act(() => result.current.showToast('진열대에 저장했습니다'))

    expect(result.current.toastProps.open).toBe(true)
    expect(result.current.toastProps.message).toBe('진열대에 저장했습니다')
  })

  it('toastProps.onClose 로 닫는다', () => {
    const { result } = renderHook(() => useToast())

    act(() => result.current.showToast('저장했습니다'))
    act(() => result.current.toastProps.onClose())

    expect(result.current.toastProps.open).toBe(false)
  })

  it('onClose 의 함수 identity 가 렌더 사이에 유지된다', () => {
    const { result, rerender } = renderHook(() => useToast())
    const first = result.current.toastProps.onClose

    rerender()

    expect(result.current.toastProps.onClose).toBe(first)
  })
})
