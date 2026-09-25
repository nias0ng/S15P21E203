import { queryOptions } from '@tanstack/react-query'

import { getMe } from './api'

export const authKeys = {
  all: ['auth'] as const,
  me: () => [...authKeys.all, 'me'] as const,
}

export const meQuery = () =>
  queryOptions({
    queryKey: authKeys.me(),
    queryFn: getMe,
    staleTime: 1000 * 60 * 5,
    retry: false,
  })
