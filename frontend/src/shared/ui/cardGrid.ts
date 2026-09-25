/**
 * 카드 격자(향수 · 브랜드 · 노트)의 열 수와 사이. 한 곳만 바꾸면 화면마다 카드 폭이
 * 달라져서 한 벌로 둡니다.
 *
 * NOTE: 넓은 화면에서 여섯 열이 필요한 자리는 `cn(CARD_GRID, 'lg:grid-cols-6')` 으로
 * 덮습니다.
 */
export const CARD_GRID =
  'grid grid-cols-2 gap-3.75 sm:grid-cols-3 lg:grid-cols-5'
