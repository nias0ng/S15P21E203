import { useCallback, useEffect } from 'react'

import { useTourStore, type TourStep } from '@/shared/store/tourStore'

/**
 * 첫 방문 안내 한 단계를 겁니다 (`tourStore`).
 *
 * @param step 이 자리가 맡은 단계
 * @param ready 그 단계를 보일 때인가 — 그 화면이 처음 섰고 다른 창에 가려 있지 않을 때
 * @returns `showing` 지금 이 자리의 안내를 그릴 차례인가 · `finish` 그 행동을 했다(또는 [×])
 */
export function useTourStep(step: TourStep, ready: boolean) {
  const want = useTourStore((state) => state.want)
  const finishStep = useTourStore((state) => state.finish)
  const showing = useTourStore((state) => state.active === step)

  useEffect(() => {
    want(step, ready)
    return () => want(step, false)
  }, [step, ready, want])

  const finish = useCallback(() => finishStep(step), [finishStep, step])
  return { showing, finish }
}
