import { useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'

import { isApiError } from '@/shared/api/http'

import { moveExploration } from '../api'
import { mapKeys } from '../queries'

/**
 * MAP-24 메인을 **떠나는 순간** 배가 있던 자리를 남깁니다
 * (`docs/배-자리와-향해일지-0921.md` §A-1).
 *
 * 왜 `useExplorationMove` 를 안 쓰는가 — 그쪽은 **같은 자리를 두 번 안 보내려고** 마지막으로
 * 보낸 값을 기억합니다. 해역이 바뀔 때마다 오는 알림에는 맞는 규칙이지만, 떠나는 순간의 저장은
 * *마지막 자리를 반드시 한 번 남기는 일*이라 그 기억에 걸리면 안 됩니다. 일지를 다시 읽지 않는
 * 것도 다릅니다 — 화면이 사라지는 참이라 읽어 봐야 쓸 데가 없습니다.
 *
 * ⚠️⚠️ **이 저장이 일지를 더럽히지 않습니다.** 서버는 좌표만 온 이동을 **향 영역이 바뀐 경우에만**
 * 일지에 남기고, 자리는 언제나 덮어씁니다 (`ExplorationService.move`). 그래서 같은 해역에서
 * 나가면 자리만 갱신되고 일지는 그대로입니다.
 *
 * ⚠️ 화면이 사라지는 중이라 **실패해도 아무것도 안 합니다.** 다음에 들어오면 예전 자리에서
 * 시작할 뿐입니다. 비로그인(401)은 실패도 아닙니다 — 서버가 남길 곳이 없다고 답한 것입니다.
 */
export function useSaveBoatPosition() {
  const queryClient = useQueryClient()

  return useCallback(
    (position: { x: number; y: number }) => {
      void moveExploration(position)
        .then((state) => {
          // 비로그인이면 남은 것이 없어(updatedAt null) 캐시를 건드릴 것도 없습니다
          if (state.updatedAt === null) return
          // 다시 들어왔을 때 방금 남긴 자리를 읽도록 캐시를 채워 둡니다
          queryClient.setQueryData(mapKeys.exploration(), state)
        })
        .catch((error: unknown) => {
          if (isApiError(error) && error.status === 401) return
          console.warn('[map] 떠나면서 배 자리를 남기지 못했습니다', error)
        })
    },
    [queryClient],
  )
}
