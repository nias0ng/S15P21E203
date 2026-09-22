import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useCallback, useRef } from 'react'

import { isApiError } from '@/shared/api/http'

import { moveExploration } from '../api'
import { mapKeys } from '../queries'
import { type ExplorationMove } from '../types'

/**
 * MAP-24 배가 옮겨 간 자리를 서버에 남기고, 향해 일지를 다시 불러옵니다.
 *
 * 엔진이 **해역이 바뀔 때**와 **향수를 고를 때** 알려 줍니다 (`ScentScene` 의 `onMove` →
 * `landing/src/host.js` 의 `moveBoat`). 기록할지는 서버가 정하므로(향수는 늘, 빈 바다는 향
 * 영역이 바뀐 경우만) 화면은 그저 옮겼다고 말하고 일지를 다시 읽습니다.
 *
 * ⚠️ 일지를 **언제나** 다시 읽지는 않습니다 — 비로그인이면 서버가 `updatedAt` 을 비워 보내고,
 * 그건 "남기지 않았다" 는 뜻이라 다시 읽어도 같은 401 입니다. 괜히 부르면 3D 를 모는 동안
 * 실패 요청이 쌓입니다.
 */
export function useExplorationMove() {
  const queryClient = useQueryClient()
  /**
   * 마지막으로 보낸 자리. 엔진이 같은 해역을 두 번 알리는 일은 없지만, 되돌아오는 항해에서
   * 같은 요청이 겹치면 서버에 같은 줄을 두 번 묻게 됩니다.
   */
  const sent = useRef<string | null>(null)

  const mutation = useMutation({
    mutationFn: moveExploration,
    onSuccess: (state) => {
      // 비로그인(updatedAt 없음)이면 남은 것이 없어 다시 읽을 것도 없습니다
      if (state.updatedAt === null) return
      void queryClient.invalidateQueries({ queryKey: mapKeys.voyageLog() })
    },
    onError: (error) => {
      // 배를 모는 도중이라 화면을 막지 않습니다 — 일지 한 줄이 빠질 뿐입니다.
      // ⚠️ 401 은 오류가 아닙니다(비로그인). 그 밖의 실패만 남깁니다
      if (isApiError(error) && error.status === 401) return
      console.warn('[map] 배를 옮긴 것을 남기지 못했습니다', error)
    },
  })

  const { mutate } = mutation

  const report = useCallback(
    (move: ExplorationMove) => {
      const key =
        move.perfumeId != null
          ? `p:${move.perfumeId}`
          : `s:${move.x ?? ''},${move.y ?? ''}`
      if (sent.current === key) return
      sent.current = key
      // 좌표도 향수 번호도 없으면 서버가 400 입니다 — 보내지 않습니다
      if (move.perfumeId == null && (move.x == null || move.y == null)) return
      mutate(move)
    },
    [mutate],
  )

  return report
}
