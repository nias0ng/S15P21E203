/**
 * 로그인 · 회원가입이 끝난 뒤 돌아갈 경로를 걸러 냅니다. 값은 주소창의
 * `?redirectTo=` 로 오므로 **앱 안의 경로만** 통과시킵니다 — 안 거르면
 * `/login?redirectTo=https://…` 한 줄로 남의 사이트로 튕기는 링크가 만들어집니다.
 *
 * 통과 조건은 **`/` 하나로 시작하고 그다음이 `/` 도 `\` 도 아닐 것** 하나입니다.
 *   - `//evil.com` 은 프로토콜만 생략한 바깥 주소입니다
 *   - `/\evil.com` 은 브라우저가 `\` 를 `/` 로 고쳐 읽어 위와 같아집니다
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
 * 돌아갈 경로의 쿼리 이름. **보내는 쪽과 읽는 쪽이 이 한 곳을 같이 봅니다** —
 * 모달은 `?redirectTo=` 로 보내는데 로그인 화면이 `location.state.from` 을 읽어,
 * 로그인하면 늘 홈으로 가던 때가 있었습니다.
 */
export const RETURN_PATH_PARAM = 'redirectTo'

/**
 * 로그인 · 회원가입 주소에 돌아갈 경로를 달아 줍니다. 세 곳이 각자 문자열을 짜면
 * 한 곳만 이름이 틀려도 조용히 홈으로 갑니다.
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
