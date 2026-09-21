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
import { AUTH_SUBMIT } from '../frame'

import { AuthCard } from './AuthCard'

/**
 * 이 화면으로 보낼 때 실어 오는 안내 (회원가입 완료 · 비밀번호 변경).
 * **돌아갈 경로는 여기 없습니다** — 주소의 `?redirectTo=` 로 옵니다.
 */
type LoginLocationState = {
  signedUp?: boolean
  passwordChanged?: boolean
} | null

/**
 * 로그인 (A28 좌측 카드 — COM-02). **요청을 두 번 보냅니다** — 로그인 응답에는
 * 토큰만 있어 `GET /users/me` 를 이어 부르고, 토큰을 먼저 스토어에 넣어야 그
 * 요청에 Authorization 이 붙습니다.
 */
type LoginFormProps = {
  /**
   * 로그인이 끝난 뒤 어디로 보낼지 화면(pages)이 정할 때 씁니다. 첫 로그인의 취향
   * 테스트 판단에 `features/taste` 가 필요한데 **`features/a` 는 `features/b` 를
   * import 할 수 없어** `pages/LoginPage` 가 정합니다.
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
   * 로그인하러 오기 전에 보던 화면(`?redirectTo=`). `onLoggedIn` 을 안 넘겼을 때만
   * 쓰지만 같은 자리를 읽어 둡니다 — 두 갈래가 다른 곳을 보면 어느 날 한쪽만
   * 고쳐지고, 이 버그가 정확히 그렇게 생겼습니다.
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

        <Button
          type="submit"
          fullWidth
          className={AUTH_SUBMIT}
          disabled={isPending}
        >
          {isPending ? '로그인 중' : '로그인'}
        </Button>
      </form>

      {/*
        양옆을 5px 씩 들여씁니다 — 판의 모서리가 둥글어 끝에 딱 붙이면 글자가 밖으로
        새어 나간 것처럼 보입니다. 회원가입의 [로그인하기 →] 와 같은 값입니다.
      */}
      <div className="text-caption flex items-center justify-between px-1.25">
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
