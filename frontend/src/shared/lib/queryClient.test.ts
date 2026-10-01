import { afterEach, describe, expect, it } from 'vitest'

import { useLocaleStore } from '@/shared/store/localeStore'

import { queryClient } from './queryClient'

afterEach(() => {
  queryClient.clear()
})

describe('queryClient — 화면 언어를 바꾸면', () => {
  it('언어에 따라 글이 달라지는 쿼리만 다시 받을 것으로 표시한다', async () => {
    await queryClient.prefetchQuery({
      queryKey: ['note', 1],
      queryFn: () => '한국어 설명',
      meta: { localeDependent: true },
    })
    await queryClient.prefetchQuery({
      queryKey: ['post', 1],
      queryFn: () => '조회수가 오르는 글',
    })

    useLocaleStore.getState().setLocale('en')

    expect(queryClient.getQueryState(['note', 1])?.isInvalidated).toBe(true)
    expect(queryClient.getQueryState(['post', 1])?.isInvalidated).toBe(false)
  })

  it('같은 언어를 다시 골라도 건드리지 않는다', async () => {
    await queryClient.prefetchQuery({
      queryKey: ['note', 2],
      queryFn: () => '한국어 설명',
      meta: { localeDependent: true },
    })

    useLocaleStore.getState().setLocale('ko')

    expect(queryClient.getQueryState(['note', 2])?.isInvalidated).toBe(false)
  })
})
