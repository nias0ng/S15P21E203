import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'

import { apiErrorMessage } from '@/shared/api/http'
import { ROUTES } from '@/shared/config/routes'
import { useEndSession } from '@/shared/hooks/useEndSession'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'
import { Modal } from '@/shared/ui/Modal'

import { changePassword } from '../api'
import { useNewPassword } from '../hooks/useNewPassword'
import { PASSWORD_MIN_LENGTH } from '../types'

import { NewPasswordFields } from './NewPasswordFields'

type Props = { open: boolean; onClose: () => void }

export function PasswordChangeModal({ open, onClose }: Props) {
  const { t } = useTranslation('auth')
  const navigate = useNavigate()
  const endSession = useEndSession()

  const [currentPassword, setCurrentPassword] = useState('')
  const newPassword = useNewPassword()

  const reset = () => {
    setCurrentPassword('')
    newPassword.reset()
  }

  const mutation = useMutation({
    mutationFn: () =>
      changePassword({ currentPassword, newPassword: newPassword.password }),
    onSuccess: () => {
      reset()
      onClose()
      endSession()
      navigate(ROUTES.LOGIN, {
        replace: true,
        state: { passwordChanged: true },
      })
    },
  })

  const close = () => {
    reset()
    mutation.reset()
    onClose()
  }

  const canSubmit =
    currentPassword.length > 0 && newPassword.valid && !mutation.isPending

  return (
    <Modal
      open={open}
      onClose={close}
      title={t('passwordChange.title')}
      footer={
        <>
          <Button variant="outline" onClick={close}>
            {t('actions.cancel')}
          </Button>
          <Button
            type="submit"
            form="password-change-form"
            disabled={!canSubmit}
          >
            {mutation.isPending
              ? t('passwordChange.submitting')
              : t('passwordChange.submit')}
          </Button>
        </>
      }
    >
      <form
        id="password-change-form"
        className="space-y-2.5"
        onSubmit={(event) => {
          event.preventDefault()
          mutation.mutate()
        }}
      >
        <Input
          label={t('password.current')}
          hideLabel
          type="password"
          autoComplete="current-password"
          placeholder={t('password.current')}
          required
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
        />
        <NewPasswordFields field="newPassword" password={newPassword} />

        {mutation.error !== null && (
          <p className="text-danger text-caption" role="alert">
            {apiErrorMessage(mutation.error, t('passwordChange.failed'))}
          </p>
        )}

        <p className="text-ink-muted text-caption">
          {t('password.rule', { min: PASSWORD_MIN_LENGTH })}
        </p>
      </form>
    </Modal>
  )
}
