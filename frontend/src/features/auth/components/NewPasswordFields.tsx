import { Input } from '@/shared/ui/Input'

import type { NewPassword } from '../hooks/useNewPassword'

type NewPasswordFieldsProps = {
  /** 첫 칸의 이름. 확인란은 뒤에 ' 확인' 을 붙입니다 */
  label: '비밀번호' | '새 비밀번호'
  /** `useNewPassword()` 가 돌려준 값 */
  password: NewPassword
}

/**
 * 새 비밀번호 두 칸. 길이 안내 문구는 화면마다 놓는 자리가 달라 부르는 쪽이 둡니다.
 */
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
