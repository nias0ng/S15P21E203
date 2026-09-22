/** 인증 · 계정 도메인 타입. 길이 제약은 백엔드 DTO 의 검증 애너테이션 값입니다 */

export const PASSWORD_MIN_LENGTH = 8

/** 서버가 앞뒤 공백을 떼고 센 길이입니다 — 화면도 같은 순서로 재야 400 이 안 납니다 */
export const NICKNAME_MIN_LENGTH = 2
export const NICKNAME_MAX_LENGTH = 20

export interface LoginInput {
  email: string
  password: string
}

export interface SignupInput {
  email: string
  password: string
  nickname: string
}

/** 서버는 새 비밀번호 확인란을 받지 않습니다 — 두 번 입력이 같은지는 화면이 봅니다 */
export interface PasswordChangeInput {
  currentPassword: string
  newPassword: string
}

/** refresh 토큰은 httpOnly 쿠키라 본문에 없습니다 — 화면이 읽는 토큰은 이것뿐입니다 */
export interface AccessTokenResponse {
  accessToken: string
}

export interface UserResponse {
  userId: number
  email: string
  nickname: string
}

export interface NicknameAvailabilityResponse {
  available: boolean
}
