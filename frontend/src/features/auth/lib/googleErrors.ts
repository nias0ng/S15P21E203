import { i18n } from '@/shared/i18n'

/*
 * Google 에서 돌아온 뒤 백엔드 콜백이 주소에 붙여 보내는 오류 코드의 문구입니다.
 *
 * NOTE: 문구를 주소에 싣지 않고 코드만 받습니다. 주소에 문구가 오면 누구나 링크로 가짜 안내를
 * 띄울 수 있습니다. 코드는 백엔드 `AuthErrorCode` 와 한 벌입니다.
 */

export const GOOGLE_ERROR_PARAM = 'googleError'
export const GOOGLE_REAUTH_PARAM = 'googleReauth'

const MESSAGE_KEYS = {
  AUTH_EMAIL_REGISTERED_WITH_PASSWORD:
    'auth:google.errors.registeredWithPassword',
  AUTH_EMAIL_ALREADY_EXISTS: 'auth:google.errors.emailExists',
  AUTH_GOOGLE_EMAIL_NOT_VERIFIED: 'auth:google.errors.emailNotVerified',
  AUTH_GOOGLE_LOGIN_CANCELLED: 'auth:google.errors.cancelled',
  AUTH_GOOGLE_LOGIN_UNAVAILABLE: 'auth:google.errors.unavailable',
  AUTH_GOOGLE_ACCOUNT_MISMATCH: 'auth:google.errors.accountMismatch',
} as const

const isKnownCode = (code: string): code is keyof typeof MESSAGE_KEYS =>
  Object.hasOwn(MESSAGE_KEYS, code)

// 문구는 부를 때 고릅니다 — 모듈을 읽을 때 정해 두면 언어를 바꿔도 처음 언어로 남습니다
export function googleErrorMessage(code: string | null): string | null {
  if (code === null || code.length === 0) {
    return null
  }
  return isKnownCode(code)
    ? i18n.t(MESSAGE_KEYS[code])
    : i18n.t('auth:google.errors.fallback')
}
