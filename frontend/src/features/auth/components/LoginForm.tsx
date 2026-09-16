import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'

import { isApiError } from '@/shared/api/http'
import { ROUTES } from '@/shared/config/routes'
import { useAuthStore } from '@/shared/store/authStore'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'

import { getMe, login, toAuthUser } from '../api'

import { AuthCard } from './AuthCard'

/** 이 화면으로 보낼 때 실어 오는 값 (보호 라우트 · 회원가입 완료 · 비밀번호 변경) */
type LoginLocationState = {
  from?: string
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
export function LoginForm() {
  const navigate = useNavigate()
  const location = useLocation()
  const setAuth = useAuthStore((state) => state.setAuth)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const state = location.state as LoginLocationState

  /**
   * 로그인하러 오기 전에 보던 화면.
   *
   * 아직 보호 라우트가 없어 지금은 거의 항상 비어 있습니다. 로그인이 필요한 화면을
   * 막기 시작하면 그 화면이 `state.from` 을 실어 보내고, 여기서 그대로 돌려보냅니다.
   */
  const from = state?.from ?? ROUTES.HOME

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
      navigate(from, { replace: true })
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
        <Link to={ROUTES.SIGNUP} className="text-ink-muted hover:text-ink">
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
