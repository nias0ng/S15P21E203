import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router'

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

import { AuthCard } from './AuthCard'

/**
 * 이 화면으로 보낼 때 실어 오는 안내 (회원가입 완료 · 비밀번호 변경).
 *
 * **돌아갈 경로는 여기 없습니다.** 그건 주소의 `?redirectTo=` 로 옵니다 —
 * 예전에는 `from` 을 여기서 읽었는데 그 값을 채우는 곳이 하나도 없어서, 로그인하면
 * 늘 홈으로 갔습니다(`shared/lib/returnPath`).
 */
type LoginLocationState = {
  signedUp?: boolean
  passwordChanged?: boolean
} | null

/**
 * 로그인 (와이어프레임 A28 좌측 카드 — COM-02)
 *
 * **요청을 두 번 보냅니다.** 로그인 응답에는 액세스 토큰만 있고 사용자 정보가
 * 없는데 스토어(`setAuth`)는 둘을 함께 받습니다. 그래서 토큰을 먼저 스토어에 넣고
 * `GET /users/me` 를 이어 부릅니다 — 토큰이 들어가야 그 요청에 Authorization 이
 * 붙습니다.
 */
type LoginFormProps = {
  /**
   * 로그인이 끝난 뒤 어디로 보낼지 화면(pages)이 정할 때 씁니다.
   *
   * 첫 로그인에는 취향 테스트로 보내야 하는데, 그 판단에 `features/taste` 의 쿼리가
   * 필요합니다. **`features/a` 는 `features/b` 를 import 할 수 없어서**(ESLint 레이어
   * 규칙) 여기서 부르지 못하고, 두 도메인을 아는 `pages/LoginPage` 가 정합니다.
   *
   * 넘기지 않으면 예전처럼 이 컴포넌트가 `from`(없으면 홈)으로 보냅니다.
   */
  onLoggedIn?: () => void
}

export function LoginForm({ onLoggedIn }: LoginFormProps = {}) {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const setAuth = useAuthStore((state) => state.setAuth)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const state = location.state as LoginLocationState

  /**
   * 로그인하러 오기 전에 보던 화면. 주소의 `?redirectTo=` 를 읽습니다.
   *
   * 이 값은 `onLoggedIn` 을 안 넘겼을 때만 씁니다 — 지금 이 폼을 쓰는 곳은
   * `pages/LoginPage` 하나이고 거기는 늘 넘깁니다(첫 로그인이면 취향 테스트로
   * 보내야 해서). 그래도 같은 자리를 읽어 둡니다. 두 갈래가 서로 다른 곳을 보면
   * 어느 날 한쪽만 고쳐지는데, 이 버그가 정확히 그렇게 생겼습니다.
   */
  const returnTo = safeReturnPath(searchParams.get(RETURN_PATH_PARAM))
  const from = returnTo ?? ROUTES.HOME

  /** 여기로 보낸 쪽이 남긴 안내. 둘이 겹칠 일은 없어 먼저 맞는 것을 씁니다 */
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

      if (onLoggedIn) onLoggedIn()
      else navigate(from, { replace: true })
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

        {/*
          서버 문구를 그대로 보여줍니다. 이메일이 없는 경우와 비밀번호가 틀린 경우를
          백엔드가 일부러 한 문장으로 합쳐 두었습니다 — 어느 쪽이 틀렸는지 알려주면
          가입된 이메일인지 확인하는 수단이 됩니다.
        */}
        {error !== null && (
          <p className="text-danger text-caption" role="alert">
            {isApiError(error)
              ? error.message
              : '로그인하지 못했습니다. 잠시 후 다시 시도해주세요.'}
          </p>
        )}

        <Button type="submit" fullWidth disabled={isPending}>
          {isPending ? '로그인 중' : '로그인'}
        </Button>
      </form>

      <div className="text-caption flex items-center justify-between">
        {/*
          돌아갈 경로를 회원가입까지 들고 갑니다. 안 들려 보내면 "로그인하려다
          계정이 없어서 가입" 한 사람만 원래 자리를 잃습니다.
        */}
        <Link
          to={withReturnPath(ROUTES.SIGNUP, returnTo)}
          className="text-ink-muted hover:text-ink"
        >
          회원가입 →
        </Link>
        {/* 와이어프레임 A31: "A28 진입점 필요" — 여기가 그 진입점입니다 */}
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
