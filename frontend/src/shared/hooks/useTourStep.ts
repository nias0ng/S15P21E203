import { useCallback, useEffect } from 'react'

import { useTourStore, type TourStep } from '@/shared/store/tourStore'

type Options = {
  /**
   * 안내가 떠 있는 동안 `ready` 가 풀리면 **본 것으로 칩니다.** 카드 · 해역 연출처럼 그 자리가 닫히는 것이
   * 곧 '할 일을 했다' 인 단계입니다 — 안 주면 접었다가 조건이 다시 맞을 때 다시 섭니다.
   */
  finishOnLeave?: boolean
}

/**
 * 첫 방문 안내 한 단계를 겁니다 (`tourStore`).
 *
 * @param step 이 자리가 맡은 단계
 * @param ready 그 단계를 보일 때인가 — 그 화면이 처음 섰고 다른 창에 가려 있지 않을 때
 * @param options `finishOnLeave` — 위 머리말
 * @returns `showing` 지금 이 자리의 안내를 그릴 차례인가 · `finish` 그 행동을 했다(또는 [×]) ·
 *   `next` 안내를 눌러 넘겼다 — 다음 안내가 제 조건과 상관없이 곧바로 섭니다
 */
export function useTourStep(
  step: TourStep,
  ready: boolean,
  { finishOnLeave = false }: Options = {},
) {
  const want = useTourStore((state) => state.want)
  const finishStep = useTourStore((state) => state.finish)
  const finishIfActive = useTourStore((state) => state.finishIfActive)
  const nextStep = useTourStore((state) => state.next)
  const showing = useTourStore((state) => state.active === step)

  useEffect(() => {
    // NOTE: 조건이 풀린 **그 순간** 떠 있었는가를 봅니다 — want(false) 가 먼저 돌면 떠 있던 것이 이미 내려가 있습니다
    if (!ready && finishOnLeave) finishIfActive(step)
    want(step, ready)
  }, [step, ready, finishOnLeave, want, finishIfActive])

  // 화면이 사라지면 조건만 거둡니다 — 끝낸 것으로 치지 않습니다 (다시 들어오면 다시 섭니다)
  useEffect(() => () => want(step, false), [step, want])

  const finish = useCallback(() => finishStep(step), [finishStep, step])
  const next = useCallback(() => nextStep(step), [nextStep, step])
  return { showing, finish, next }
}
