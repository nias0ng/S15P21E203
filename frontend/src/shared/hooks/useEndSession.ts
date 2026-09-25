import { useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'

import { useAuthStore } from '@/shared/store/authStore'

/**
 * 이 브라우저의 로그인 흔적을 지우는 함수를 돌려줍니다 (로그아웃 · 비밀번호 변경 · 탈퇴).

 * 토큰을 먼저 버려야 남아 있는 쿼리가 죽은 토큰으로 다시 나가지 않고,
 * 캐시까지 지워야 같은 브라우저에서 다음에 로그인한 사람이 앞 사람 화면을 잠깐 보지 않습니다.

 * NOTE: 세션이 저절로 끊길 때의 정리(`http.ts` 의 `endSession`)와 하는 일이 같지만,
 *   전역 캐시가 아니라 **이 트리의 QueryClient** 를 비웁니다

 * @returns 부르면 토큰과 캐시를 비우는 함수. 렌더가 바뀌어도 같은 함수입니다
 */
export function useEndSession(): () => void {
  const queryClient = useQueryClient()

  return useCallback(() => {
    useAuthStore.getState().clear()
    queryClient.clear()
  }, [queryClient])
}
