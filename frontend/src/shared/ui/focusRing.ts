/**
 * 키보드로 짚었을 때 보이는 테두리.
 *
 * **Tailwind v4 의 preflight 가 브라우저 기본 outline 을 지웁니다.** 그래서 이걸
 * 안 붙인 `<button>` 은 탭으로 옮겨 가도 **아무 표시가 없습니다** — 눌리는 것은
 * 맞는데 어디에 서 있는지 화면에 안 나옵니다(S15P21E203-398 에서 네 곳 발견).
 *
 * 링 색이 `accent-deep` 인 까닭은 `accent` 가 ivory 위 2.90:1 이라 기준(3:1)에 못
 * 미쳐서입니다 — `buttonVariants` 와 같은 값을 써야 화면마다 링이 달라지지 않습니다.
 *
 * 공용 `Button` 을 쓰면 이미 들어 있습니다. 타일 · 목록 줄처럼 `Button` 으로
 * 표현되지 않는 누름에만 손으로 붙입니다.
 */
export const FOCUS_RING =
  'outline-none focus-visible:ring-2 focus-visible:ring-accent-deep focus-visible:ring-offset-2'
