import { useMediaQuery } from '@/shared/hooks/useMediaQuery'

/**
 * 진열대 화면의 배치.
 *
 *   overlay  한 장 배치 — 벽 위 오른쪽에 상세 패널을 얹고, 페이지를 스크롤하지 않습니다.
 *            진열대 ↔ 내 컬렉션은 하단 띠의 단추로 무대를 바꿉니다.
 *   stacked  쌓는 배치 — 벽을 화면 폭 가득 두고 그 아래로 페이저 · 상세 카드 · 내 컬렉션을
 *            이어 세웁니다. 페이지가 세로로 스크롤됩니다.
 */
export type ShelfArrangement = 'overlay' | 'stacked'

/**
 * 한 장 배치를 쓰는 폭(lg, 1024~).
 *
 * 이보다 좁으면 상세 패널을 벽 위에 얹을 때 패널이 읽히는 크기(0.85 배, lib.ts 의
 * PANEL_MIN_SCALE)를 지키면서 패널에 가리지 않는 병을 네 개 이상 세울 수 없습니다.
 * 패널을 더 줄여 억지로 한 장에 담지 않고 배치를 바꿉니다.
 */
const OVERLAY_QUERY = '(width >= 64rem)'

/**
 * 지금 화면 폭에 맞는 진열대 배치.
 *
 * CSS 만으로 가르지 않는 이유: 두 배치는 조각의 **자리**가 다릅니다(패널이 벽 안에 얹히느냐,
 * 벽 밖 아래에 서느냐 · 무대를 바꾸느냐, 이어 세우느냐). CSS 로 둘 다 그려 두고 하나를
 * 숨기면 병 사진 스물다섯 장이 든 벽이 두 벌 그려집니다.
 */
export function useShelfArrangement(): ShelfArrangement {
  // 폭을 모르면(matchMedia 가 없는 곳 · 서버 렌더) 한 장 배치로 둡니다
  return useMediaQuery(OVERLAY_QUERY, true) ? 'overlay' : 'stacked'
}
