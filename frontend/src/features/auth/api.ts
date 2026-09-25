import { http } from '@/shared/api/http'
import type { AuthUser } from '@/shared/store/authStore'

import type {
  AccessTokenResponse,
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

export async function withdraw(password: string): Promise<void> {
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
