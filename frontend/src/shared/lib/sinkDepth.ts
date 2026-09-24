/**
 * 내린 거리 → 수면 아래로 가라앉은 정도. `halfScreens` 화면만큼 내리면 절반이고, 더 내릴수록
 * 1 에 가까워질 뿐 넘지 않습니다.
 *
 * 페이지 길이가 아니라 **내린 거리**로 잽니다 — 목록이 무한 스크롤로 불어나도 이미 내려온
 * 깊이가 튀지 않습니다.
 *
 * @param scrollY 내린 거리(px). 맨 위에서 튕겨 음수가 되어도 0 으로 봅니다
 * @param viewportHeight 창 높이(px)
 * @param halfScreens 절반만큼 가라앉는 거리(화면 수)
 * @returns 0(수면 바로 아래) ~ 1(아주 깊은 곳)
 */
export function sinkDepth(
  scrollY: number,
  viewportHeight: number,
  halfScreens: number,
): number {
  const screens = Math.max(scrollY, 0) / Math.max(viewportHeight, 1)
  return 1 - 0.5 ** (screens / halfScreens)
}
