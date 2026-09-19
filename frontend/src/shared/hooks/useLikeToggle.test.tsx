import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '@/shared/store/authStore'

import { useLikeToggle } from './useLikeToggle'

const result = (liked: boolean, likeCount: number) => ({ liked, likeCount })

const setup = (
  onToggled?: (r: { liked: boolean; likeCount: number }) => void,
) => {
  const like = vi.fn(async () => result(true, 8))
  const unlike = vi.fn(async () => result(false, 7))

  const client = new QueryClient()
  const hook = renderHook(() => useLikeToggle({ like, unlike, onToggled }), {
    wrapper: ({ children }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  })

  return { ...hook, like, unlike }
}

const logIn = () =>
  useAuthStore.getState().setAuth({
    accessToken: 'token',
    user: { id: 1, nickname: '향해', email: 'a@b.c' },
  })

afterEach(() => {
  useAuthStore.getState().clear()
})

describe('useLikeToggle', () => {
  /*
    이 갈래가 훅을 만든 이유입니다 — 세 화면이 각자 쓰다가 한 곳에서 빠져 있었습니다.
  */
  it('비로그인이면 서버에 보내지 않고 로그인 안내를 켠다', () => {
    const { result: hook, like, unlike } = setup()

    act(() => hook.current.toggle({ id: 1, liked: false }))

    expect(hook.current.loginRequired).toBe(true)
    expect(like).not.toHaveBeenCalled()
    expect(unlike).not.toHaveBeenCalled()
  })

  it('안내를 닫을 수 있다', () => {
    const { result: hook } = setup()

    act(() => hook.current.toggle({ id: 1, liked: false }))
    act(() => hook.current.closeLoginRequired())

    expect(hook.current.loginRequired).toBe(false)
  })

  it('아직 안 누른 줄이면 좋아요를 부른다', async () => {
    logIn()
    const { result: hook, like, unlike } = setup()

    act(() => hook.current.toggle({ id: 7, liked: false }))

    await waitFor(() => expect(like).toHaveBeenCalledWith(7))
    expect(unlike).not.toHaveBeenCalled()
    expect(hook.current.loginRequired).toBe(false)
  })

  it('이미 누른 줄이면 취소를 부른다', async () => {
    logIn()
    const { result: hook, like, unlike } = setup()

    act(() => hook.current.toggle({ id: 7, liked: true }))

    await waitFor(() => expect(unlike).toHaveBeenCalledWith(7))
    expect(like).not.toHaveBeenCalled()
  })

  it('응답을 부르는 쪽에 그대로 넘긴다 — 캐시는 화면이 고칩니다', async () => {
    logIn()
    const onToggled = vi.fn()
    const { result: hook } = setup(onToggled)

    act(() => hook.current.toggle({ id: 7, liked: false }))

    await waitFor(() =>
      expect(onToggled).toHaveBeenCalledWith({ liked: true, likeCount: 8 }),
    )
  })
})
