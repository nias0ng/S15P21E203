/**
 * 인증 · 계정 도메인 타입 (A28 · A29 · A30 — COM-01 · 02 · 04 · 06). 길이 제약은
 * 백엔드 요청 DTO 의 검증 애너테이션을 그대로 옮긴 값입니다.
 */

/** 비밀번호는 최소 8자입니다 (`@Size(min = 8, max = 64)`) */
export const PASSWORD_MIN_LENGTH = 8

/**
 * 닉네임 2~20자. **앞뒤 공백을 제거한 뒤**의 길이입니다 — 서버가 trim 하고 셉니다.
 * 화면에서도 같은 순서로 재야 "공백만 스무 자"가 통과했다가 400 이 나지 않습니다.
 */
export const NICKNAME_MIN_LENGTH = 2
export const NICKNAME_MAX_LENGTH = 20

/** POST /auth/login 요청 */
export interface LoginInput {
  email: string
  password: string
}

/** POST /auth/signup 요청 */
export interface SignupInput {
  email: string
  password: string
  nickname: string
}

/**
 * PATCH /users/me/password 요청
 *
 * 서버는 **새 비밀번호 확인란을 받지 않습니다.** 두 번 입력이 같은지는 화면이 봅니다.
 */
export interface PasswordChangeInput {
  currentPassword: string
  newPassword: string
}

/**
 * POST /auth/login · POST /auth/refresh 응답. **refresh token 은 본문에 없습니다** —
 * httpOnly 쿠키라, 화면이 읽을 수 있는 토큰은 액세스 토큰 하나뿐입니다.
 */
export interface AccessTokenResponse {
  accessToken: string
}

/**
 * GET /users/me · POST /auth/signup 응답. 서버는 `userId`, 스토어는 `id` 라
 * 옮기는 일은 `api.ts` 의 `toAuthUser` 한 곳에서만 합니다.
 */
export interface UserResponse {
  userId: number
  email: string
  nickname: string
}

/** GET /users/nickname-availability 응답 */
export interface NicknameAvailabilityResponse {
  available: boolean
}
