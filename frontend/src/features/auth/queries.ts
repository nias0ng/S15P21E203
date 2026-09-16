import { queryOptions } from '@tanstack/react-query'

import { getMe } from './api'

export const authKeys = {
  all: ['auth'] as const,
  me: () => [...authKeys.all, 'me'] as const,
}

/**
 * 내 정보. **로그인했을 때만 켜세요.**
 *
 *   useQuery({ ...meQuery(), enabled: isLoggedIn })
 *
 * 비로그인으로 부르면 401 이고, 응답 인터셉터가 그 401 을 로그아웃으로 처리합니다.
 * 401 은 다시 물어도 같은 답이라 재시도하지 않습니다.
 */
export const meQuery = () =>
  queryOptions({
    queryKey: authKeys.me(),
    queryFn: getMe,
    staleTime: 1000 * 60 * 5,
    retry: false,
  })
