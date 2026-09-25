import { useEffect } from 'react'

import type { PerfumeViewSource } from '@/shared/config/perfumeViewSource'
import { useIsLoggedIn } from '@/shared/store/authStore'

import { exitPerfumeView, startPerfumeView } from '../api'

const START_DELAY_MS = 250

/**
 * NOTE: **탭을 닫으면 나가는 기록이 남지 않습니다** — 정리 함수에 기대는데
 * `sendBeacon` 은 Authorization 을 못 실어, 체류 시간이 일부 빕니다.
 */
export function usePerfumeViewLog(
  perfumeId: number | null,
  source: PerfumeViewSource,
  fromPerfumeId?: number,
): void {
  const isLoggedIn = useIsLoggedIn()

  useEffect(() => {
    if (!isLoggedIn || perfumeId === null) return

    let startedId: number | null = null
    let left = false

    const timer = setTimeout(() => {
      startPerfumeView({ perfumeId, fromLocationType: source, fromPerfumeId })
        .then((started) => {
          if (left) void exitPerfumeView(started.perfumeViewId).catch(() => {})
          else startedId = started.perfumeViewId
        })
        .catch(() => {})
    }, START_DELAY_MS)

    return () => {
      left = true
      clearTimeout(timer)
      if (startedId !== null) void exitPerfumeView(startedId).catch(() => {})
    }
  }, [perfumeId, source, fromPerfumeId, isLoggedIn])
}
