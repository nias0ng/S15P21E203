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

/** 서버의 `userId` 를 스토어의 `id` 로 옮깁니다. 이름이 어긋나는 자리는 여기뿐입니다. */
export function toAuthUser(user: UserResponse): AuthUser {
  return { id: user.userId, email: user.email, nickname: user.nickname }
}

/**
 * 로그인. 액세스 토큰만 돌아와 사용자 정보는 `getMe()` 로 따로 받고, 토큰을 먼저
 * 스토어에 넣어야 그 요청에 Authorization 이 붙습니다.
 */
export async function login(input: LoginInput): Promise<string> {
  const { data } = await http.post<AccessTokenResponse>('/auth/login', input)
  return data.accessToken
}

export async function getMe(): Promise<UserResponse> {
  const { data } = await http.get<UserResponse>('/users/me')
  return data
}

/** 회원가입. 응답에 토큰이 없어 가입만 되고 로그인은 되지 않습니다 */
export async function signup(input: SignupInput): Promise<UserResponse> {
  const { data } = await http.post<UserResponse>('/auth/signup', input)
  return data
}

/** 참이어도 확인과 저장 사이에 남이 가져가면 저장 시점에 409 입니다 */
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

/**
 * 회원 탈퇴. axios 의 `delete` 는 두 번째 인자가 config 라 본인 확인 비밀번호를
 * `{ data }` 로 넣어야 본문에 실립니다 — 그냥 넘기면 본문 없이 나가 400 입니다.
 */
export async function withdraw(password: string): Promise<void> {
  await http.delete('/users/me', { data: { password } })
}

/**
 * 로그아웃. 스토어만 비우면 부족합니다 — refresh 토큰은 httpOnly 쿠키라 화면이 못
 * 지우고, 서버에 안 알리면 그 쿠키로 다시 토큰을 받습니다.
 */
export async function logout(): Promise<void> {
  await http.post('/auth/logout')
}

/**
 * 이메일 중복 확인. 서버가 앞뒤 공백을 떼고 소문자로 바꿔 보므로 화면도 같은 값을
 * 보냅니다 — 다르게 다듬으면 "쓸 수 있다" 고 해 놓고 가입에서 막힙니다.
 */
export async function checkEmailAvailability(email: string): Promise<boolean> {
  const { data } = await http.get<{ available: boolean }>(
    '/users/email-availability',
    { params: { email } },
  )
  return data.available
}

/** 닉네임 변경. 로그인 세션은 유지됩니다(비밀번호 변경과 다릅니다) */
export async function changeNickname(nickname: string): Promise<UserResponse> {
  const { data } = await http.patch<UserResponse>('/users/me/nickname', {
    nickname,
  })
  return data
}
