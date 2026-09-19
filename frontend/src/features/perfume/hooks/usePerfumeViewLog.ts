import { useEffect } from 'react'

import type { PerfumeViewSource } from '@/shared/config/perfumeViewSource'
import { useIsLoggedIn } from '@/shared/store/authStore'

import { exitPerfumeView, startPerfumeView } from '../api'

/**
 * 스쳐 지나간 것은 세지 않습니다 — 이 시간 안에 떠나면 기록을 시작하지 않습니다.
 * StrictMode 의 두 번 실행도 이 지연이 함께 막아 줍니다.
 */
const START_DELAY_MS = 250

/**
 * 향수 상세 조회 기록 (VIEW-01). 들어오면 `POST /perfume-views`, 떠나면
 * `PATCH /perfume-views/{id}/exit` 이고 **체류 시간은 서버가 잽니다.**
 *
 * ⚠️ **탭을 닫거나 브라우저를 끄면 나가는 기록이 남지 않습니다** — 정리 함수가 도는
 * 것에 기대는데 `sendBeacon` 은 Authorization 을 못 실습니다. **체류 시간이 일부
 * 비는 것을 전제로** 보세요. 비로그인이면 아무것도 보내지 않습니다(401).
 */
export function usePerfumeViewLog(
  perfumeId: number,
  source: PerfumeViewSource,
  fromPerfumeId?: number,
): void {
  const isLoggedIn = useIsLoggedIn()

  useEffect(() => {
    if (!isLoggedIn || !Number.isFinite(perfumeId)) return

    let startedId: number | null = null
    let left = false

    const timer = setTimeout(() => {
      startPerfumeView({ perfumeId, fromLocationType: source, fromPerfumeId })
        .then((started) => {
          /*
            요청이 오가는 사이에 화면을 떠났으면 받자마자 닫습니다. 열어 둔 채로 두면
            그 사람의 다음 기록이 앞 기록과 겹칩니다.
          */
          if (left) void exitPerfumeView(started.perfumeViewId).catch(() => {})
          else startedId = started.perfumeViewId
        })
        // 기록이 실패해도 화면은 그대로 돕니다. 사용자가 할 일이 없는 값입니다
        .catch(() => {})
    }, START_DELAY_MS)

    return () => {
      left = true
      clearTimeout(timer)
      if (startedId !== null) void exitPerfumeView(startedId).catch(() => {})
    }
  }, [perfumeId, source, fromPerfumeId, isLoggedIn])
}
