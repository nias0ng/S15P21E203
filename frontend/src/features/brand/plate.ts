/**
 * 브랜드 로고가 앉는 판.
 *
 * NOTE: **흰색으로 못 박습니다.** 로고는 배경이 투명한 PNG 에 검은 글자라 어두운 방
 * 위에 그대로 두면 묻힙니다. 같은 까닭으로 판 위 글자도 역할 토큰(`text-ink-muted`)을
 * 못 씁니다 — 어두운 방에서 밝은 색으로 뒤집혀 흰 판 위에서 사라집니다.
 *
 * 목록(`BrandGrid`)과 상세(`BrandDetailPage`)가 같이 씁니다. 따로 적으면 한쪽만
 * 고쳐져 화면을 오갈 때 판 색이 바뀝니다.
 */
export const BRAND_PLATE = 'border border-black/10 bg-white text-charcoal-soft'
