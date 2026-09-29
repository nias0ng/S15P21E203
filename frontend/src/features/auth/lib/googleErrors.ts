/*
 * Google 에서 돌아온 뒤 백엔드 콜백이 주소에 붙여 보내는 오류 코드의 문구입니다.
 *
 * NOTE: 문구를 주소에 싣지 않고 코드만 받습니다. 주소에 문구가 오면 누구나 링크로 가짜 안내를
 * 띄울 수 있습니다. 코드는 백엔드 `AuthErrorCode` 와 한 벌입니다.
 */

export const GOOGLE_ERROR_PARAM = 'googleError'
export const GOOGLE_REAUTH_PARAM = 'googleReauth'

const MESSAGES: Record<string, string> = {
  AUTH_EMAIL_REGISTERED_WITH_PASSWORD:
    '이미 이메일로 가입된 계정입니다. 이메일과 비밀번호로 로그인해주세요.',
  AUTH_EMAIL_ALREADY_EXISTS: '이미 가입된 이메일입니다.',
  AUTH_GOOGLE_EMAIL_NOT_VERIFIED:
    '이메일 인증을 마친 Google 계정만 쓸 수 있습니다.',
  AUTH_GOOGLE_LOGIN_CANCELLED: 'Google 로그인을 취소했습니다.',
  AUTH_GOOGLE_LOGIN_UNAVAILABLE: '지금은 Google 로그인을 쓸 수 없습니다.',
  AUTH_GOOGLE_ACCOUNT_MISMATCH: '가입할 때 쓴 Google 계정으로 확인해주세요.',
}

const FALLBACK = 'Google 로그인을 마치지 못했습니다. 처음부터 다시 해주세요.'

export function googleErrorMessage(code: string | null): string | null {
  if (code === null || code.length === 0) {
    return null
  }
  return MESSAGES[code] ?? FALLBACK
}
