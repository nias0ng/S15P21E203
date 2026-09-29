import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router'

import { apiErrorMessage } from '@/shared/api/http'
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

type LoginLocationState = {
  signedUp?: boolean
  passwordChanged?: boolean
} | null

type LoginFormProps = {
  onLoggedIn: (from: string) => void
}

export function LoginForm({ onLoggedIn }: LoginFormProps) {
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const setAuth = useAuthStore((state) => state.setAuth)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const state = location.state as LoginLocationState

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
    onError: () => useAuthStore.getState().clear(),
  })

  return (
    <AuthCard title="로그인" large>
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

        {error !== null && (
          <p className="text-danger text-caption" role="alert">
            {apiErrorMessage(
              error,
              '로그인하지 못했습니다. 잠시 후 다시 시도해주세요.',
            )}
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
