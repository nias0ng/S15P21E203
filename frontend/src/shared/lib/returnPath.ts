/**
 * 로그인 · 회원가입이 끝난 뒤 돌아갈 경로를 걸러 냅니다.
 *
 * 돌아갈 곳은 **주소창의 `?redirectTo=`** 로 옵니다(`shared/ui/LoginRequiredDialog`).
 * 주소는 누구나 지어낼 수 있으므로 **앱 안의 경로만** 통과시킵니다 — 안 거르면
 * `/login?redirectTo=https://…` 한 줄로 "로그인하자마자 남의 사이트로 튕기는" 링크가
 * 만들어지고, 그 링크는 우리 도메인으로 시작해서 눌러 보기 전에는 구분되지 않습니다.
 *
 * 통과 조건은 하나입니다: **`/` 하나로 시작하고 그다음이 `/` 도 `\` 도 아닐 것.**
 *   - `//evil.com` 은 프로토콜만 생략한 바깥 주소입니다
 *   - `/\evil.com` 은 브라우저가 `\` 를 `/` 로 고쳐 읽어 위와 같아집니다
 *   - `https:` · `javascript:` 처럼 스킴이 붙은 값은 애초에 `/` 로 시작하지 않습니다
 *
 * 앞뒤 공백도 다듬지 않고 그대로 떨어뜨립니다. 다듬어서 통과시키기 시작하면
 * "무엇을 다듬는가" 가 또 하나의 규칙이 되고, 정상적인 링크에는 공백이 없습니다.
 *
 * 값이 없거나 걸러지면 `null` 입니다 — 부르는 쪽이 자기 기본값(대개 홈)을 씁니다.
 */
export function safeReturnPath(
  value: string | null | undefined,
): string | null {
  if (!value) return null
  if (!value.startsWith('/')) return null
  if (value.startsWith('//') || value.startsWith('/\\')) return null
  return value
}

/**
 * 돌아갈 경로의 쿼리 이름.
 *
 * **보내는 쪽과 읽는 쪽이 이 한 곳을 같이 봅니다.** 예전에는 모달이 `?redirectTo=` 로
 * 실어 보내는데 로그인 화면은 `location.state.from` 을 읽고 있어서, 아무도 채우지
 * 않는 값을 읽느라 로그인하면 늘 홈으로 갔습니다. 이름을 상수 하나로 묶어 두면
 * 그 어긋남이 타입 검사에 걸립니다.
 */
export const RETURN_PATH_PARAM = 'redirectTo'

/**
 * 로그인 · 회원가입 주소에 돌아갈 경로를 달아 줍니다.
 *
 * `LoginRequiredDialog`(로그인 · 회원가입 두 단추)와 회원가입 완료 뒤 로그인으로
 * 넘기는 자리가 같이 씁니다. 세 곳이 각자 문자열을 짜면 한 곳만 이름이 틀려도
 * 조용히 홈으로 갑니다.
 */
export function withReturnPath(
  path: string,
  returnTo: string | null | undefined,
): string {
  const safe = safeReturnPath(returnTo)
  return safe
    ? `${path}?${RETURN_PATH_PARAM}=${encodeURIComponent(safe)}`
    : path
}
