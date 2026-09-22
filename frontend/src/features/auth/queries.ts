import { queryOptions } from '@tanstack/react-query'

import { getMe } from './api'

export const authKeys = {
  all: ['auth'] as const,
  me: () => [...authKeys.all, 'me'] as const,
}

/** 로그인했을 때만 켜세요 — 비로그인 401 을 인터셉터가 로그아웃으로 처리합니다 */
export const meQuery = () =>
  queryOptions({
    queryKey: authKeys.me(),
    queryFn: getMe,
    staleTime: 1000 * 60 * 5,
    retry: false,
  })
