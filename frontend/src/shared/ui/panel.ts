/**
 * 종이 바탕 위에 얹는 밝은 판. 글 덩어리를 종이에 맨몸으로 두면 어디서 시작하고
 * 끝나는지 경계가 없어서, 한 단 밝은 판을 깔아 보이게 합니다.
 *
 * 여백이 다른 자리에서는 뒤에 덮어씁니다: `cn(PANEL, 'p-4')`.
 */
export const PANEL =
  'border-line/50 bg-surface-card rounded-panel shadow-card border p-6'

/**
 * 어두운 방 위에 떠 있는 유리판의 **모양값**(모서리 · 여백).
 * 생김새는 `styles/scent-display.css` · 설계는 docs/어두운-방-유리판.md
 *
 * ⚠️ 어두운 방을 켠 화면(라우트의 `handle.night`)에서만 씁니다 — 밝은 화면에서는
 * 뒤가 어둡지 않아 아무 일도 하지 않습니다.
 */
export const GLASS_PANEL = 'scent-glass rounded-[36px] p-7.5 pt-6.25'

/** 좁은 곁판(255px). 같은 유리인데 모서리와 여백만 작습니다 */
export const GLASS_PANEL_ASIDE = 'scent-glass rounded-[20px] p-5'
