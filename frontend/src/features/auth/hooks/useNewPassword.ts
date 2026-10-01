import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { PASSWORD_MIN_LENGTH } from '../types'

export function useNewPassword() {
  const { t } = useTranslation('auth')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')

  const passwordError =
    password.length > 0 && password.length < PASSWORD_MIN_LENGTH
      ? t('password.tooShort', { min: PASSWORD_MIN_LENGTH })
      : undefined

  const confirmError =
    confirm.length > 0 && confirm !== password
      ? t('password.mismatch')
      : undefined

  return {
    password,
    setPassword,
    confirm,
    setConfirm,
    passwordError,
    confirmError,
    valid: password.length >= PASSWORD_MIN_LENGTH && confirm === password,
    reset: () => {
      setPassword('')
      setConfirm('')
    },
  }
}

export type NewPassword = ReturnType<typeof useNewPassword>
