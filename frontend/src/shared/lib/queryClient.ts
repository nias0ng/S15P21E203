import { QueryClient } from '@tanstack/react-query'

import { isApiError, setSessionExpiredHandler } from '@/shared/api/http'

/** 전역 QueryClient. 기본값을 여기서 고정하고 개별 쿼리가 필요할 때만 덮어씁니다 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60,
      gcTime: 1000 * 60 * 10,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        // 4xx 는 다시 보내도 답이 같습니다
        if (isApiError(error) && error.status >= 400 && error.status < 500) {
          return false
        }
        return failureCount < 2
      },
    },
    mutations: {
      retry: 0,
    },
  },
})

/* 세션이 저절로 끊길 때도 캐시를 비웁니다 — 다음 사람이 앞 사람 화면을 보지 않게 */
setSessionExpiredHandler(() => {
  queryClient.clear()
})
