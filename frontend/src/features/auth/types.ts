export const PASSWORD_MIN_LENGTH = 8

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

export interface PasswordChangeInput {
  currentPassword: string
  newPassword: string
}

export interface AccessTokenResponse {
  accessToken: string
}

export interface UserResponse {
  userId: number
  email: string
  nickname: string
  profileImageUrl: string | null
  // false 면 Google 로 가입한 계정입니다 — 비밀번호 변경이 없고, 탈퇴 확인을 Google 로 합니다.
  hasPassword: boolean
  googleConnected: boolean
}

export interface GoogleSignupInfo {
  email: string
  suggestedNickname: string | null
}

export interface NicknameAvailabilityResponse {
  available: boolean
}
