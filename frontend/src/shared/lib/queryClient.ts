import { QueryClient } from '@tanstack/react-query'

import { isApiError, setSessionExpiredHandler } from '@/shared/api/http'
import { useLocaleStore } from '@/shared/store/localeStore'

declare module '@tanstack/react-query' {
  interface Register {
    queryMeta: {
      /**
       * 서버가 요청 언어(`Accept-Language`)로 고른 글을 주는 쿼리 — 노트 설명 · AI 후기 요약처럼 한 언어만
       * 옵니다. 화면 언어를 바꾸면 이 쿼리만 다시 받습니다(아래 구독). 이름처럼 두 언어를 짝으로 주는
       * 응답은 화면이 고르므로 달지 않습니다.
       */
      localeDependent?: boolean
    }
  }
}

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

/*
 * 화면 언어를 바꾸면 언어에 따라 글이 달라지는 쿼리(`meta.localeDependent`)만 다시 받습니다 — 앞 언어로
 * 받아 둔 설명이 남지 않게. 전부 다시 받지 않는 까닭은 GET 에도 부작용이 있어서입니다: 글 상세는 조회수가
 * 오르고, 개인화 추천은 부를 때마다 다른 병을 뽑고, 자연어 추천은 AI 를 다시 부릅니다.
 *
 * 요청 머리의 언어는 보낼 때 저장소에서 읽으므로(`shared/api/http`) 여기서 다시 받는 요청은 새 언어입니다.
 */
useLocaleStore.subscribe((state, previous) => {
  if (state.locale === previous.locale) return
  void queryClient.invalidateQueries({
    predicate: (query) => query.meta?.localeDependent === true,
  })
})
