/**
 * 브랜드 로고 주소 거르기
 *
 * ⚠️ **로고 사진을 다시 모아 우리 쪽에 올리면 이 파일과 `api.ts` 의 `map` 을 지우세요.**
 *
 * 백엔드는 7,872개 중 7,092개에 `https://img.logo.dev/{도메인}` 을 내려주는데
 * **토큰이 빠져 있어 401 이 돌아옵니다.** 비어 있는 게 아니라 죽은 주소라 더
 * 나쁩니다 — `Thumbnail` 이 `<img>` 를 그려 깨진 아이콘이 격자 가득 깔리고, 뜨지도
 * 않을 요청이 7,092번 나갑니다. 통과시키는 것은 `logo_override` 의 52개뿐입니다.
 */

/** seed 가 만드는 죽은 주소의 호스트. 이 호스트만 정확히 걸러냅니다 */
const UNUSABLE_HOST = 'img.logo.dev'

/**
 * 쓸 수 있는 로고 주소만 남기고 나머지는 null 로 만듭니다 — null 을 받은 화면은
 * "로고" 자리표시자를 그립니다.
 */
export function usableLogoUrl(logoUrl: string | null): string | null {
  if (!logoUrl) return null

  try {
    return new URL(logoUrl).hostname === UNUSABLE_HOST ? null : logoUrl
  } catch {
    // 주소로 읽히지 않는 값(빈 문자열 · 상대 경로 조각)은 어차피 못 씁니다
    return null
  }
}
