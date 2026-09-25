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

export function withReturnPath(
  path: string,
  returnTo: string | null | undefined,
): string {
  const safe = safeReturnPath(returnTo)
  return safe
    ? `${path}?${RETURN_PATH_PARAM}=${encodeURIComponent(safe)}`
    : path
}
