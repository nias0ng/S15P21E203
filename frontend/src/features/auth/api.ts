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

// 경로에 '/api/v1' 을 붙이지 않습니다 — http 의 baseURL 에 이미 있습니다

/** 서버의 `userId` 를 스토어의 `id` 로 옮깁니다. 이름이 어긋나는 자리는 여기뿐입니다. */
export function toAuthUser(user: UserResponse): AuthUser {
  return { id: user.userId, email: user.email, nickname: user.nickname }
}

/**
 * 로그인. **액세스 토큰만 돌아옵니다** — 사용자 정보는 `getMe()` 로 따로 받습니다.
 *
 * 스토어의 `setAuth` 는 토큰과 사용자를 함께 받으므로 호출부가 두 요청을 묶습니다.
 * 토큰을 먼저 스토어에 넣어야 이어지는 `getMe()` 에 Authorization 이 붙습니다.
 *
 * 이메일 · 비밀번호가 틀리면 401 입니다 (`AUTH_INVALID_CREDENTIALS`).
 */
export async function login(input: LoginInput): Promise<string> {
  const { data } = await http.post<AccessTokenResponse>('/auth/login', input)
  return data.accessToken
}

/** 내 정보. 로그인이 필요합니다 */
export async function getMe(): Promise<UserResponse> {
  const { data } = await http.get<UserResponse>('/users/me')
  return data
}

/**
 * 회원가입. 가입만 되고 **로그인은 되지 않습니다** — 응답에 토큰이 없습니다.
 *
 * 이미 쓰는 이메일 · 닉네임이면 409 입니다 (`AUTH_EMAIL_ALREADY_EXISTS` ·
 * `AUTH_NICKNAME_ALREADY_EXISTS`).
 */
export async function signup(input: SignupInput): Promise<UserResponse> {
  const { data } = await http.post<UserResponse>('/auth/signup', input)
  return data
}

/**
 * 닉네임 중복 확인. 비로그인으로도 부를 수 있습니다.
 *
 * **참이어도 가입 · 변경이 반드시 되는 것은 아닙니다.** 확인과 저장 사이에 다른
 * 사람이 같은 닉네임을 가져갈 수 있어, 저장 시점에 409 로 한 번 더 걸립니다.
 */
export async function checkNicknameAvailability(
  nickname: string,
): Promise<boolean> {
  const { data } = await http.get<NicknameAvailabilityResponse>(
    '/users/nickname-availability',
    { params: { nickname } },
  )
  return data.available
}

/** 비밀번호 변경. 현재 비밀번호가 틀리면 400 (`AUTH_CURRENT_PASSWORD_MISMATCH`) */
export async function changePassword(
  input: PasswordChangeInput,
): Promise<void> {
  await http.patch('/users/me/password', input)
}

/**
 * 회원 탈퇴. 본인 확인용 비밀번호를 **본문에** 담습니다.
 *
 * axios 의 `delete` 는 두 번째 인자가 본문이 아니라 config 입니다. 그래서 본문은
 * `{ data }` 로 넣어야 실려 나갑니다 — 객체를 그대로 넘기면 본문 없이 나가 400 입니다.
 */
export async function withdraw(password: string): Promise<void> {
  await http.delete('/users/me', { data: { password } })
}

/**
 * 로그아웃. 지금 세션만 끝냅니다.
 *
 * 스토어를 비우는 것만으로는 부족합니다 — refresh 토큰은 httpOnly 쿠키라 화면이
 * 지울 수 없고, 서버에 알리지 않으면 그 쿠키로 다시 액세스 토큰을 받을 수 있습니다.
 */
export async function logout(): Promise<void> {
  await http.post('/auth/logout')
}

/**
 * 이메일 중복 확인 (A28 회원가입). 비로그인으로도 부를 수 있습니다.
 *
 * 가입과 **같은 방식으로** 앞뒤 공백을 떼고 소문자로 바꿔 봅니다 — 화면이 다르게
 * 다듬으면 "쓸 수 있다" 고 해 놓고 가입에서 막힙니다.
 *
 * 닉네임과 마찬가지로 참이어도 가입 시점에 다시 확인합니다(409).
 * 형식이 틀리면 400 입니다.
 */
export async function checkEmailAvailability(email: string): Promise<boolean> {
  const { data } = await http.get<{ available: boolean }>(
    '/users/email-availability',
    { params: { email } },
  )
  return data.available
}

/**
 * 닉네임 변경 (A29). 로그인이 필요합니다.
 *
 * 지금 쓰는 닉네임을 그대로 보내도 성공합니다(바꾸지 않습니다). 이미 남이 쓰는
 * 닉네임이면 409, 형식이 틀리면 400 입니다. **로그인 세션은 유지됩니다** —
 * 비밀번호 변경과 다른 점입니다.
 *
 * 바뀐 내 정보가 응답으로 옵니다. 화면이 그 값을 캐시에 넣으면 헤더의 닉네임까지
 * 한 번에 바뀝니다.
 */
export async function changeNickname(nickname: string): Promise<UserResponse> {
  const { data } = await http.patch<UserResponse>('/users/me/nickname', {
    nickname,
  })
  return data
}
