import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
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
import { GoogleLoginSection } from './GoogleLoginSection'

type LoginLocationState = {
  signedUp?: boolean
  passwordChanged?: boolean
} | null

type LoginFormProps = {
  onLoggedIn: (from: string) => void
}

export function LoginForm({ onLoggedIn }: LoginFormProps) {
  const { t } = useTranslation('auth')
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
      ? t('login.passwordChanged')
      : state?.signedUp === true
        ? t('login.signedUp')
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
    <AuthCard title={t('login.title')} large>
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
          label={t('email.label')}
          hideLabel
          type="email"
          autoComplete="email"
          placeholder={t('email.label')}
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <Input
          label={t('password.label')}
          hideLabel
          type="password"
          autoComplete="current-password"
          placeholder={t('password.label')}
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />

        {error !== null && (
          <p className="text-danger text-caption" role="alert">
            {apiErrorMessage(error, t('login.failed'))}
          </p>
        )}

        <Button
          type="submit"
          fullWidth
          className={AUTH_SUBMIT}
          disabled={isPending}
        >
          {isPending ? t('login.submitting') : t('login.submit')}
        </Button>
      </form>

      <GoogleLoginSection label={t('google.loginButton')} returnTo={returnTo} />

      <div className="text-caption flex items-center justify-between px-1.25">
        <Link
          to={withReturnPath(ROUTES.SIGNUP, returnTo)}
          className="text-ink-muted hover:text-ink"
        >
          {t('login.toSignup')}
        </Link>
        <Link
          to={ROUTES.PASSWORD_RESET}
          className="text-ink-muted hover:text-ink"
        >
          {t('login.findPassword')}
        </Link>
      </div>
    </AuthCard>
  )
}
