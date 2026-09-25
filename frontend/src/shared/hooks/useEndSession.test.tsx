import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { useAuthStore } from '@/shared/store/authStore'

import { useEndSession } from './useEndSession'

const setup = () => {
  const client = new QueryClient()
  const hook = renderHook(() => useEndSession(), {
    wrapper: ({ children }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  })
  return { ...hook, client }
}

afterEach(() => {
  useAuthStore.setState({ accessToken: null, user: null })
})

describe('useEndSession', () => {
  it('토큰과 이 트리의 캐시를 함께 비운다', () => {
    useAuthStore.getState().setAuth({
      accessToken: 'token',
      user: { id: 1, nickname: '향해', email: 'a@b.c' },
    })
    const { result, client } = setup()
    client.setQueryData(['users', 'me'], { nickname: '향해' })

    act(() => result.current())

    expect(useAuthStore.getState().accessToken).toBeNull()
    expect(useAuthStore.getState().user).toBeNull()
    expect(client.getQueryData(['users', 'me'])).toBeUndefined()
  })

  it('다시 그려도 같은 함수를 돌려준다', () => {
    const { result, rerender } = setup()
    const first = result.current

    rerender()

    expect(result.current).toBe(first)
  })
})
