import { useState } from 'react'

import { PASSWORD_MIN_LENGTH } from '../types'

/**
 * 새 비밀번호와 그 확인란 (회원가입 · 비밀번호 재설정 · 비밀번호 변경). 서버는 확인란을
 * 받지 않아, 두 번 입력이 같은지는 화면이 봅니다.
 *
 * @returns 두 칸의 값과 바꾸는 함수, 칸마다의 오류 문구, 보내도 되는지(`valid`), 비우기
 */
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
