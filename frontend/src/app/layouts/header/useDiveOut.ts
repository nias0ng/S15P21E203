import { useLocation } from 'react-router'

import { ROUTES } from '@/shared/config/routes'
import { diveDepthOf } from '@/shared/lib/diveTrack'
import { useDiveStore } from '@/shared/store/diveStore'

import { useWarm } from './useWarm'

/*
 * 잠수 연출(`shared/ui/DiveCurtain`)을 거는 유일한 자리입니다.
 *
 * NOTE: 어느 화면이 잠수 대상인지는 헤더가 알지 않습니다 — `diveDepthOf(주소)` 가
 * 깊이를 주면 대상입니다(`shared/lib/diveTrack`). 헤더에 목록을 또 적으면 화면이
 * 늘 때 한쪽만 고쳐집니다. 메인 경계를 넘을 때만이고, 콘텐츠끼리는 즉시 넘어갑니다.
 */

/** 새 탭 · 새 창으로 여는 누름 — 가로채면 링크가 링크이기를 그만둡니다 */
export const opensElsewhere = (event: React.MouseEvent) =>
  event.metaKey || event.ctrlKey || event.shiftKey || event.altKey

/**
 * 메인에서 콘텐츠 화면으로 나가는 누름을 가로챕니다 — 그 자리가 아니면 `undefined`,
 * 즉 평소의 `NavLink` 입니다. 주요 메뉴와 커뮤니티 펼침 메뉴가 이 하나를 같이 씁니다.
 */
export function useDiveOut() {
  const onMain = useLocation().pathname === ROUTES.HOME
  const startDive = useDiveStore((state) => state.start)
  const warm = useWarm()

  return (to: string) => {
    const depth = diveDepthOf(to)
    if (!onMain || depth === null) return undefined
    return (event: React.MouseEvent) => {
      if (opensElsewhere(event)) return
      // 덮은 뒤에 커튼이 직접 옮겨 갑니다 — 먼저 옮기면 3D 가 사라진 자리가 한 장 비칩니다
      event.preventDefault()
      warm(to)
      startDive(to, 'dive', depth)
    }
  }
}
