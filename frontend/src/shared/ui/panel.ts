/**
 * 종이 바탕 위에 얹는 밝은 판.
 *
 * 페이지 바탕이 종이(따뜻한 베이지)라, 글 덩어리를 그 위에 맨몸으로 두면 어디서
 * 시작하고 끝나는지 경계가 없습니다. 한 단 밝은 판을 깔아 "여기부터 이 글" 을
 * 보이게 합니다.
 *
 * 향수 상세(A10)의 다섯 구역과 게시글 상세(A23)의 본문 · 댓글이 같은 판을 씁니다.
 * 두 도메인이 쓰게 되어 shared 로 올렸습니다 — features/community 는
 * features/perfume 을 import 할 수 없습니다(ESLint).
 *
 * 여백이 다른 자리에서는 뒤에 덮어씁니다: `cn(PANEL, 'p-4')`.
 * `cn()` 이 tailwind-merge 라 나중 것이 이깁니다.
 */
export const PANEL =
  'border-line/50 bg-surface-card rounded-panel shadow-card border p-6'
