import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'

import { AUTH_SUBMIT } from '../frame'
import { useNewPassword } from '../hooks/useNewPassword'
import { PASSWORD_MIN_LENGTH } from '../types'

import { AuthCard } from './AuthCard'
import { BackToLogin } from './BackToLogin'
import { NewPasswordFields } from './NewPasswordFields'

export function PasswordFindForm() {
  const { t } = useTranslation('auth')
  const [sentTo, setSentTo] = useState<string | null>(null)

  if (sentTo !== null) {
    return (
      <AuthCard
        title={t('passwordFind.sentTitle')}
        description={t('passwordFind.sentDescription')}
      >
        <p
          aria-live="polite"
          className="border-line bg-line-soft text-ink text-caption border p-2.5"
        >
          {t('passwordFind.sentBody', { email: sentTo })}
        </p>

        <Button variant="outline" fullWidth onClick={() => setSentTo(null)}>
          {t('passwordFind.retry')}
        </Button>

        <BackToLogin />
      </AuthCard>
    )
  }

  return (
    <AuthCard
      title={t('passwordFind.title')}
      description={t('passwordFind.description')}
    >
      <form
        className="space-y-2.5"
        onSubmit={(event) => {
          event.preventDefault()
          const form = new FormData(event.currentTarget)
          // NOTE: 서버에 붙이지 않습니다 — 백엔드에 재설정 메일 API 가 없습니다.
          setSentTo(String(form.get('email') ?? ''))
        }}
      >
        <Input
          label={t('email.label')}
          hideLabel
          name="email"
          type="email"
          autoComplete="email"
          placeholder={t('email.label')}
          required
        />
        <Button type="submit" fullWidth className={AUTH_SUBMIT}>
          {t('passwordFind.submit')}
        </Button>
      </form>

      <BackToLogin />
    </AuthCard>
  )
}

export function PasswordResetForm() {
  const { t } = useTranslation('auth')
  const password = useNewPassword()

  return (
    <AuthCard
      title={t('passwordReset.title')}
      description={t('passwordReset.description')}
    >
      <form
        className="space-y-2.5"
        onSubmit={(event) => {
          event.preventDefault()
          // NOTE: 서버에 붙이지 않습니다 — 백엔드에 재설정 API 가 없습니다.
        }}
      >
        <NewPasswordFields field="newPassword" password={password} />

        <p className="text-ink-muted text-caption">
          {t('password.rule', { min: PASSWORD_MIN_LENGTH })}
        </p>

        <Button
          type="submit"
          fullWidth
          className={AUTH_SUBMIT}
          disabled={!password.valid}
        >
          {t('passwordReset.submit')}
        </Button>
      </form>

      <BackToLogin />
    </AuthCard>
  )
}
