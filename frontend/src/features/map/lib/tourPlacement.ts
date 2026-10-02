import type { TourAnchor } from './tourAnchor'

/**
 * 안내가 상자의 어느 쪽에 서는가.
 *
 *   above     위 가운데 (부표 이름표 · 하단 안내) — 자리가 없으면 아래
 *   below     아래 가운데 (카드 — 단추 줄이 아래끝입니다) — 자리가 없으면 위
 *   aboveEnd  위 · 오른끝 맞춤 (미니맵 — 화면 오른쪽 아래 구석입니다)
 *   side      옆 (배 — 선실 말풍선처럼 옆구리에 붙습니다)
 */
export type TourPlacement = 'above' | 'below' | 'aboveEnd' | 'side'

/** 상자와 안내 사이 */
const GAP = 10
/** 안내가 판 끝에서 떨어지는 만큼 */
const MARGIN = 12

/**
 * 안내 한 줄의 왼쪽 위 자리를 냅니다. 판(안내가 서는 칸) 안으로 밀어 넣습니다.
 *
 * @param anchor 붙을 상자 — 판 기준 CSS px (`tourAnchor` 의 뷰포트 자리에서 판의 자리를 뺀 값)
 * @param tip 안내의 폭 · 높이
 * @param area 판의 폭 · 높이
 * @param placement 위 `TourPlacement`
 * @returns 안내의 왼쪽 위 (판 기준 CSS px)
 */
export function placeTourTip(
  anchor: TourAnchor,
  tip: { w: number; h: number },
  area: { w: number; h: number },
  placement: TourPlacement,
): { x: number; y: number } {
  const centerX = anchor.x + anchor.w / 2 - tip.w / 2
  const above = anchor.y - GAP - tip.h
  const below = anchor.y + anchor.h + GAP
  const fitsAbove = above >= MARGIN
  const fitsBelow = below + tip.h <= area.h - MARGIN

  let x: number
  let y: number
  switch (placement) {
    case 'above':
      x = centerX
      y = fitsAbove || !fitsBelow ? above : below
      break
    case 'below':
      x = centerX
      y = fitsBelow || !fitsAbove ? below : above
      break
    case 'aboveEnd':
      x = anchor.x + anchor.w - tip.w
      y = fitsAbove || !fitsBelow ? above : below
      break
    case 'side':
      x = anchor.side >= 0 ? anchor.x : anchor.x - tip.w
      y = anchor.y + anchor.h / 2 - tip.h / 2
      break
  }

  return {
    x: clamp(x, MARGIN, area.w - MARGIN - tip.w),
    y: clamp(y, MARGIN, area.h - MARGIN - tip.h),
  }
}

/** 판이 안내보다 좁으면 왼쪽 · 위 여백을 지킵니다 */
function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(value, max))
}
