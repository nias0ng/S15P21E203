/**
 * 인증 · 계정 도메인 타입 (와이어프레임 A28 · A29 · A30 — COM-01 · 02 · 04 · 06)
 *
 * 길이 제약은 백엔드 요청 DTO 의 검증 애너테이션을 그대로 옮긴 값입니다. 화면에서
 * 먼저 걸러야 서버까지 갔다가 400 을 받고 돌아오는 왕복이 없습니다. 백엔드가 값을
 * 바꾸면 여기만 고칩니다.
 */

/** 비밀번호 8~64자 (`@Size(min = 8, max = 64)`) */
export const PASSWORD_MIN_LENGTH = 8
export const PASSWORD_MAX_LENGTH = 64

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
 * POST /auth/login · POST /auth/refresh 응답
 *
 * **refresh token 은 본문에 없습니다** — httpOnly 쿠키로 따로 옵니다. 그래서
 * 프론트가 저장하거나 읽을 수 있는 토큰은 액세스 토큰 하나뿐입니다.
 */
export interface AccessTokenResponse {
  accessToken: string
}

/**
 * GET /users/me · POST /auth/signup 응답
 *
 * 서버는 `userId`, 스토어(`AuthUser`)는 `id` 입니다. 이름이 어긋나는 자리가 여기
 * 하나라, 옮기는 일도 `api.ts` 의 `toAuthUser` 한 곳에서만 합니다.
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
