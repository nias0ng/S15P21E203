/**
 * 종이 바탕 위에 얹는 밝은 판. 글 덩어리를 종이에 맨몸으로 두면 어디서 시작하고
 * 끝나는지 경계가 없어서, 한 단 밝은 판을 깔아 보이게 합니다.
 *
 * 여백이 다른 자리에서는 뒤에 덮어씁니다: `cn(PANEL, 'p-4')`.
 */
export const PANEL =
  'border-line/50 bg-surface-card rounded-panel shadow-card border p-6'

/**
 * 어두운 방(`.scent-night`) 위에 떠 있는 유리판.
 *
 * 생김새는 `styles/scent-display.css` 의 `.scent-glass` 에 있고, 여기 있는 것은
 * 그 클래스와 함께 쓰는 **모양값**(모서리 · 여백)입니다. 위 여백만 25px 인 이유는
 * 판 첫 줄이 늘 제목이라, 사방을 30px 로 두면 제목 위가 넓어 보여서입니다.
 *
 * 이 문자열이 향수 목록 · 향수 검색 결과 · 브랜드 목록 · 노트 목록에 복사돼 있었고,
 * 향수 상세가 판 네 장을 더 쓰면서 여덟 자리가 되어 여기로 올렸습니다.
 *
 * ⚠️ **판 밖에서는 아무 일도 하지 않습니다.** `.scent-glass` 는 뒤가 어두워야
 * 유리로 보이므로, 어두운 방을 켠 화면(라우트의 `handle.night`)에서만 씁니다.
 */
export const GLASS_PANEL = 'scent-glass rounded-[36px] p-7.5 pt-6.25'
