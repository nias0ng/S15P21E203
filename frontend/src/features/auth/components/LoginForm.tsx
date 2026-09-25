import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router'

import { isApiError } from '@/shared/api/http'
import { ROUTES } from '@/shared/config/routes'
import {
  RETURN_PATH_PARAM,
  safeReturnPath,
  withReturnPath,
} from '@/shared/lib/returnPath'
import { useAuthStore } from '@/shared/store/authStore'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'

import { getMe, login, toAuthUser } from '../api'
import { AUTH_SUBMIT } from '../frame'

import { AuthCard } from './AuthCard'

/** 여기로 보낼 때 실어 오는 안내. 돌아갈 경로는 주소의 `?redirectTo=` 로 옵니다 */
type LoginLocationState = {
  signedUp?: boolean
  passwordChanged?: boolean
} | null

/**
 * 로그인 (A28 좌측 카드 — COM-02). 요청이 두 번 나갑니다 — 응답에 토큰만 있어
 * `GET /users/me` 를 이어 부르고, 토큰을 먼저 스토어에 넣어야 Authorization 이
 * 붙습니다.
 */
type LoginFormProps = {
  /**
   * 로그인 뒤 갈 곳은 화면이 정합니다. 첫 로그인 판단에 `features/taste` 가 필요한데
   * `features/a` 는 `features/b` 를 import 할 수 없어 `pages/LoginPage` 가 정합니다.
   *
   * @param from 주소에 달려 온 돌아갈 자리. 없거나 앱 밖이면 홈
   */
  onLoggedIn: (from: string) => void
}

export function LoginForm({ onLoggedIn }: LoginFormProps) {
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const setAuth = useAuthStore((state) => state.setAuth)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const state = location.state as LoginLocationState

  // 돌아갈 곳을 주소에 싣는 이유: 라우터 state 는 새로고침하면 사라져, 비밀번호를
  // 찾다 돌아오면 돌아갈 곳을 잃습니다
  const returnTo = safeReturnPath(searchParams.get(RETURN_PATH_PARAM))
  const from = returnTo ?? ROUTES.HOME

  const notice =
    state?.passwordChanged === true
      ? '비밀번호가 변경됐습니다. 새 비밀번호로 다시 로그인해주세요.'
      : state?.signedUp === true
        ? '가입이 완료됐습니다. 로그인해주세요.'
        : null

  const { mutate, isPending, error } = useMutation({
    mutationFn: async () => {
      const accessToken = await login({ email, password })
      useAuthStore.getState().setAccessToken(accessToken)

      return { accessToken, user: toAuthUser(await getMe()) }
    },
    onSuccess: ({ accessToken, user }) => {
      setAuth({ accessToken, user })
      onLoggedIn(from)
    },
    // 토큰만 든 반쪽 상태로 두지 않습니다 — 로그인한 것처럼 보이는데 내가 누군지 모릅니다
    onError: () => useAuthStore.getState().clear(),
  })

  return (
    <AuthCard title="로그인">
      {notice !== null && (
        <p className="border-line bg-line-soft text-ink text-caption border p-2.5">
          {notice}
        </p>
      )}

      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault()
          mutate()
        }}
      >
        <Input
          label="이메일"
          hideLabel
          type="email"
          autoComplete="email"
          placeholder="이메일"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <Input
          label="비밀번호"
          hideLabel
          type="password"
          autoComplete="current-password"
          placeholder="비밀번호"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />

        {/* 서버 문구를 그대로 보여줍니다 — 없는 이메일과 틀린 비밀번호를 백엔드가 일부러 한 문장으로 합쳤습니다(가입 여부를 알아내는 수단이 됩니다) */}
        {error !== null && (
          <p className="text-danger text-caption" role="alert">
            {isApiError(error)
              ? error.message
              : '로그인하지 못했습니다. 잠시 후 다시 시도해주세요.'}
          </p>
        )}

        <Button
          type="submit"
          fullWidth
          className={AUTH_SUBMIT}
          disabled={isPending}
        >
          {isPending ? '로그인 중' : '로그인'}
        </Button>
      </form>

      <div className="text-caption flex items-center justify-between px-1.25">
        {/* 돌아갈 경로를 회원가입까지 들고 갑니다 — 안 들려 보내면 "로그인하려다 계정이 없어 가입" 한 사람만 원래 자리를 잃습니다 */}
        <Link
          to={withReturnPath(ROUTES.SIGNUP, returnTo)}
          className="text-ink-muted hover:text-ink"
        >
          회원가입 →
        </Link>
        <Link
          to={ROUTES.PASSWORD_RESET}
          className="text-ink-muted hover:text-ink"
        >
          비밀번호 찾기
        </Link>
      </div>
    </AuthCard>
  )
}
