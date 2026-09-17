/**
 * 브랜드 로고 주소 거르기
 *
 * ⚠️ **로고 사진을 다시 모아 우리 쪽에 올리면 이 파일을 지우세요.** 그때는 주소가 전부
 * 살아 있어서 걸러낼 이유가 없습니다. `api.ts` 의 `map` 도 함께 되돌립니다.
 *
 * 백엔드는 브랜드 7,872개 중 7,092개에 `https://img.logo.dev/{도메인}` 을 로고 주소로
 * 내려줍니다. seed 가 `brands_ko.csv` 의 `logo_domain` 으로 만든 주소인데
 * (`backend/db/seed/load_perfume_catalog.sql`), **토큰이 빠져 있어 401 이 돌아옵니다.**
 *
 * 주소가 비어 있는 게 아니라 "죽은 주소가 들어 있는" 상태라서 화면이 더 나쁩니다 —
 * `Thumbnail` 은 `src` 가 있으면 `<img>` 를 그리므로, 자리표시자 대신 브라우저의
 * 깨진 이미지 아이콘이 격자 가득 깔립니다. 거기에 뜨지도 않을 요청이 7,092번 나갑니다.
 *
 * 그래서 화면에 닿기 전에 null 로 바꿉니다. 실제로 보이는 로고는 CSV 의 `logo_override`
 * 에서 온 52개뿐이고, 그것만 통과시킵니다.
 */

/** seed 가 만드는 죽은 주소의 호스트. 이 호스트만 정확히 걸러냅니다 */
const UNUSABLE_HOST = 'img.logo.dev'

/**
 * 쓸 수 있는 로고 주소만 남기고 나머지는 null 로 만듭니다.
 *
 * null 을 받은 화면은 "로고" 자리표시자를 그립니다 — 로고가 없는 브랜드와 같은 모습이고,
 * 실제로 지금은 같은 처지라 그게 맞습니다.
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
