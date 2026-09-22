/**
 * 브랜드 로고 주소 거르기.
 *
 * NOTE: 백엔드가 내려주는 `img.logo.dev` 주소는 토큰이 빠져 401 입니다 — 비어 있는 게
 * 아니라 죽은 주소라, 걸러내지 않으면 깨진 아이콘이 격자 가득 깔립니다.
 */

const UNUSABLE_HOST = 'img.logo.dev'

export function usableLogoUrl(logoUrl: string | null): string | null {
  if (!logoUrl) return null

  try {
    return new URL(logoUrl).hostname === UNUSABLE_HOST ? null : logoUrl
  } catch {
    // 주소로 읽히지 않는 값(빈 문자열 · 상대 경로)은 어차피 못 씁니다
    return null
  }
}
