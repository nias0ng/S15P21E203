import { useEffect, useState } from 'react'

import { secondsUntil } from '../lib/verification'

type Running = { deadline: number; now: number }

/**
 * 초 단위 카운트다운. 틱마다 1씩 빼지 않고 마감 시각과 지금을 비교합니다 —
 * 탭이 뒤로 가면 브라우저가 타이머를 늦추는데, 빼기 방식이면 그만큼 시간이 늘어납니다.
 */
export function useCountdown() {
  const [running, setRunning] = useState<Running | null>(null)
  const deadline = running?.deadline ?? null

  useEffect(() => {
    if (deadline === null) {
      return
    }
    const timer = setInterval(() => {
      const now = Date.now()
      setRunning((current) => (current === null ? null : { ...current, now }))
      if (now >= deadline) {
        clearInterval(timer)
      }
    }, 1000)
    return () => clearInterval(timer)
  }, [deadline])

  return {
    /** 멈춰 있으면 null. 다 되면 0 에서 멈춥니다 */
    remaining:
      running === null ? null : secondsUntil(running.deadline, running.now),
    start: (seconds: number) => {
      const now = Date.now()
      setRunning({ deadline: now + seconds * 1000, now })
    },
    stop: () => setRunning(null),
  }
}
