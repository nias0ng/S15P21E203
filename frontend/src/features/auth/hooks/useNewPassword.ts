import { useState } from 'react'

import { PASSWORD_MIN_LENGTH } from '../types'

export function useNewPassword() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')

  const passwordError =
    password.length > 0 && password.length < PASSWORD_MIN_LENGTH
      ? `비밀번호는 ${PASSWORD_MIN_LENGTH}자 이상이어야 합니다`
      : undefined

  const confirmError =
    confirm.length > 0 && confirm !== password
      ? '비밀번호가 서로 다릅니다'
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
