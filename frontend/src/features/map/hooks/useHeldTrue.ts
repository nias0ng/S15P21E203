import { useEffect, useState } from 'react'

/**
 * true 에서 false 로 내려가는 것을 `ms` 만큼 늦춥니다. 그 사이에 다시 true 가 되면 내려간 적이 없는 것으로 칩니다.
 *
 * 엔진의 카드는 부표를 누르면 향수 고르기로 넘어가며 한 번 접혔다 새 자리에서 다시 뜹니다(엔진 `cardFollowFade` ·
 * 0.3초 남짓). 그 틈을 '카드가 닫혔다' 로 읽으면 첫 방문 안내가 뜨자마자 끝납니다.
 *
 * @param value 지금 값
 * @param ms 늦출 시간. 0 이하면 그대로 돌려줍니다
 * @returns 늦춘 값
 */
export function useHeldTrue(value: boolean, ms: number): boolean {
  const [held, setHeld] = useState(value)
  // 그리는 중에 맞춥니다 — 효과에서 맞추면 올라간 첫 장이 한 번 false 로 그려집니다
  if (value && !held) setHeld(true)

  useEffect(() => {
    if (value || !held || ms <= 0) return
    const timer = window.setTimeout(() => setHeld(false), ms)
    return () => window.clearTimeout(timer)
  }, [value, held, ms])

  return ms <= 0 ? value : value || held
}
