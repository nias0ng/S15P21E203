import { Input } from '@/shared/ui/Input'

import type { NewPassword } from '../hooks/useNewPassword'

type NewPasswordFieldsProps = {
  label: '비밀번호' | '새 비밀번호'
  password: NewPassword
}

export function NewPasswordFields({ label, password }: NewPasswordFieldsProps) {
  return (
    <>
      <Input
        label={label}
        hideLabel
        type="password"
        autoComplete="new-password"
        placeholder={label}
        required
        value={password.password}
        onChange={(event) => password.setPassword(event.target.value)}
        error={password.passwordError}
      />
      <Input
        label={`${label} 확인`}
        hideLabel
        type="password"
        autoComplete="new-password"
        placeholder={`${label} 확인`}
        required
        value={password.confirm}
        onChange={(event) => password.setConfirm(event.target.value)}
        error={password.confirmError}
      />
    </>
  )
}
