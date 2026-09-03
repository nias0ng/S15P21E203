import { QueryClient } from '@tanstack/react-query'

import { isApiError } from '@/shared/api/http'

/**
 * 전역 QueryClient.
 * 기본값을 팀 컨벤션으로 한 곳에서 고정해두고, 개별 쿼리에서 필요할 때만 덮어씁니다.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // 1분간은 캐시를 신선한 것으로 간주
      gcTime: 1000 * 60 * 10,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        // 4xx 는 재시도해도 결과가 같으므로 즉시 실패 처리
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
