import { useLocation } from 'react-router'

import { ROUTES } from '@/shared/config/routes'
import { diveDepthOf } from '@/shared/lib/diveTrack'
import { useDiveStore } from '@/shared/store/diveStore'

import { useWarm } from './useWarm'

/*
 * ───────── 잠수를 거는 자리 (2026-09-18 · 2026-09-20 다섯 화면으로) ─────────
 *
 * 메인(3D 향 지도)과 콘텐츠 화면 사이를 넘을 때만 3D 카메라가 수면으로 내려가고 커튼이 차오릅니다
 * (`shared/ui/DiveCurtain`). 여기가 그 **유일한 입구**입니다 — 헤더 말고는 두 쪽을 잇는 길이 없습니다.
 *
 * ⚠⚠ **어느 화면이 잠수 대상인지 헤더가 알지 않습니다.** `diveDepthOf(주소)` 가 깊이를 주면
 *   대상이고 `null` 이면 아닙니다 (`shared/lib/diveTrack` 의 `DIVE_DEPTH`). 헤더에 목록을
 *   또 적으면 화면이 늘 때 두 곳을 고치게 되고, 한쪽만 고쳐집니다.
 * ⚠⚠ **메인 경계를 넘을 때만입니다.** 콘텐츠끼리(향수 → 브랜드)는 즉시 넘어갑니다 — 이미 물
 *   밑인데 물을 다시 건널 까닭이 없고, 메뉴로 목록 사이를 오가는 일이 매번 1.4초씩 걸리면
 *   메뉴가 무거워집니다.
 */

/** 새 탭 · 새 창으로 여는 누름 — 가로채면 링크가 링크이기를 그만둡니다 */
export const opensElsewhere = (event: React.MouseEvent) =>
  event.metaKey || event.ctrlKey || event.shiftKey || event.altKey

/**
 * **메인에서** 콘텐츠 화면으로 나가는 누름을 가로챕니다 — 그 자리가 아니면 `undefined`,
 * 즉 평소의 `NavLink` 입니다.
 *
 * 주요 메뉴(향수 · 브랜드 · 노트)와 커뮤니티 펼침 메뉴(후기 · 자유)가 **이 하나**를 같이 씁니다.
 * 둘로 나누면 한쪽에만 깊이를 넘기거나 한쪽만 보조키를 놓치게 됩니다.
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
      // 덮은 **뒤에** 커튼이 직접 옮겨 갑니다 — 먼저 옮기면 3D 가 사라진 자리가 한 장 비칩니다
      event.preventDefault()
      warm(to)
      startDive(to, 'dive', depth)
    }
  }
}
