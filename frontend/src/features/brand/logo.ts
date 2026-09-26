// NOTE: 백엔드가 내려주는 `img.logo.dev` 주소는 토큰이 빠져 401 입니다
// — 비어 있는 게 아니라 죽은 주소라, 걸러내지 않으면 깨진 아이콘이 격자 가득 깔립니다.

const UNUSABLE_HOST = 'img.logo.dev'

export function usableLogoUrl(logoUrl: string | null): string | null {
  if (!logoUrl) return null

  try {
    return new URL(logoUrl).hostname === UNUSABLE_HOST ? null : logoUrl
  } catch {
    return null
  }
}
