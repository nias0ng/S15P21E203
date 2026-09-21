/**
 * 로그인 · 회원가입이 끝난 뒤 돌아갈 경로를 걸러 냅니다.
 *
 * 값이 주소창(`?redirectTo=`)으로 들어오므로 **앱 안의 경로만** 통과시킵니다 —
 * 안 거르면 `/login?redirectTo=https://…` 한 줄로 남의 사이트로 튕기는 링크가
 * 만들어집니다. `//evil.com` 은 프로토콜만 생략한 바깥 주소이고, `/\evil.com` 은
 * 브라우저가 `\` 를 `/` 로 고쳐 읽어 같아집니다.
 *
 * @param value 주소창에서 읽은 값
 * @returns 앱 안의 경로, 아니면 `null` — 부르는 쪽이 자기 기본값(대개 홈)을 씁니다
 */
export function safeReturnPath(
  value: string | null | undefined,
): string | null {
  if (!value) return null
  if (!value.startsWith('/')) return null
  if (value.startsWith('//') || value.startsWith('/\\')) return null
  return value
}

/** NOTE: 돌아갈 경로의 쿼리 이름. 보내는 쪽과 읽는 쪽이 이 한 곳을 같이 봐야 합니다 */
export const RETURN_PATH_PARAM = 'redirectTo'

/**
 * 로그인 · 회원가입 주소에 돌아갈 경로를 달아 줍니다.
 *
 * @param path 보낼 곳 (`ROUTES.LOGIN` · `ROUTES.SIGNUP`)
 * @param returnTo 돌아올 경로. 걸러지면 안 답니다
 * @returns `?redirectTo=` 가 붙은 주소, 또는 `path` 그대로
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
