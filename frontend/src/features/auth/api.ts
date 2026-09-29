import { http } from '@/shared/api/http'
import { env } from '@/shared/config/env'
import { RETURN_PATH_PARAM, safeReturnPath } from '@/shared/lib/returnPath'
import type { AuthUser } from '@/shared/store/authStore'

import type {
  AccessTokenResponse,
  GoogleSignupInfo,
  LoginInput,
  NicknameAvailabilityResponse,
  PasswordChangeInput,
  SignupInput,
  UserResponse,
} from './types'

export function toAuthUser(user: UserResponse): AuthUser {
  return { id: user.userId, email: user.email, nickname: user.nickname }
}

export async function login(input: LoginInput): Promise<string> {
  const { data } = await http.post<AccessTokenResponse>('/auth/login', input)
  return data.accessToken
}

/**
 * Google 로그인 화면으로 가는 주소입니다. axios 가 아니라 **페이지 이동**으로 엽니다. 백엔드가 Google 로
 * 302 를 보내고, Google 에서 돌아오면 백엔드 콜백이 `ROUTES.GOOGLE_LOGIN` 이나 `ROUTES.GOOGLE_SIGNUP`
 * 으로 보냅니다.
 */
export function googleAuthorizeUrl(returnTo: string | null): string {
  const safe = safeReturnPath(returnTo)
  const query = safe ? `?${RETURN_PATH_PARAM}=${encodeURIComponent(safe)}` : ''
  return `${env.apiBaseUrl}/auth/google/authorize${query}`
}

// Google 콜백이 Refresh Token 쿠키만 심고 돌아오므로, Access Token 은 여기서 받습니다.
export async function refreshSession(): Promise<string> {
  const { data } = await http.post<AccessTokenResponse>('/auth/refresh')
  return data.accessToken
}

// 가입표는 HttpOnly 쿠키라 화면이 직접 들고 있지 않습니다. 쿠키로 서버가 찾아 줍니다.
export async function getGoogleSignup(): Promise<GoogleSignupInfo> {
  const { data } = await http.get<GoogleSignupInfo>('/auth/google/signup')
  return data
}

export async function googleSignup(nickname: string): Promise<string> {
  const { data } = await http.post<AccessTokenResponse>('/auth/google/signup', {
    nickname,
  })
  return data.accessToken
}

// 탈퇴 전 Google 재확인. 받은 주소로 페이지를 옮기면 확인 뒤 `/account?googleReauth=ok` 로 돌아옵니다.
export async function startGoogleReauth(): Promise<string> {
  const { data } = await http.post<{ authorizationUrl: string }>(
    '/auth/google/reauth',
  )
  return data.authorizationUrl
}

export async function getMe(): Promise<UserResponse> {
  const { data } = await http.get<UserResponse>('/users/me')
  return data
}

export async function signup(input: SignupInput): Promise<UserResponse> {
  const { data } = await http.post<UserResponse>('/auth/signup', input)
  return data
}

export async function checkNicknameAvailability(
  nickname: string,
): Promise<boolean> {
  const { data } = await http.get<NicknameAvailabilityResponse>(
    '/users/nickname-availability',
    { params: { nickname } },
  )
  return data.available
}

export async function changePassword(
  input: PasswordChangeInput,
): Promise<void> {
  await http.patch('/users/me/password', input)
}

// Google 로 가입한 계정은 비밀번호 없이 보냅니다 — 서버가 방금 마친 Google 재확인을 봅니다.
export async function withdraw(password: string | null): Promise<void> {
  await http.delete('/users/me', { data: { password } })
}

export async function logout(): Promise<void> {
  await http.post('/auth/logout')
}

export async function checkEmailAvailability(email: string): Promise<boolean> {
  const { data } = await http.get<{ available: boolean }>(
    '/users/email-availability',
    { params: { email } },
  )
  return data.available
}

export async function changeNickname(nickname: string): Promise<UserResponse> {
  const { data } = await http.patch<UserResponse>('/users/me/nickname', {
    nickname,
  })
  return data
}

export async function uploadProfileImage(file: File): Promise<string> {
  const body = new FormData()
  body.append('file', file)

  const { data } = await http.post<{ profileImageUrl: string }>(
    '/users/me/profile-image',
    body,
  )
  return data.profileImageUrl
}

export async function removeProfileImage(): Promise<void> {
  await http.delete('/users/me/profile-image')
}
