import { useId } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/shared/lib/cn'
import { Input } from '@/shared/ui/Input'

import type { NewPassword } from '../hooks/useNewPassword'

type Field = 'password' | 'newPassword'

type NewPasswordFieldsProps = {
  /** 회원가입은 `password`, 바꾸거나 다시 정할 때는 `newPassword` 입니다 */
  field: Field
  password: NewPassword
  /** 두 칸을 테 하나 안에 선 하나로 나눠 붙입니다 (회원가입) */
  joined?: boolean
}

const JOINED_FIELD = cn(
  'text-body h-10 w-full bg-transparent px-2.5',
  'placeholder:text-ink-muted/70',
  // NOTE: Input 과 같이 포커스 링을 달지 않습니다
  'outline-none',
)

const LABEL_KEYS = {
  password: {
    label: 'password.label',
    confirm: 'password.confirm',
    reenter: 'password.reenter',
  },
  newPassword: {
    label: 'password.newLabel',
    confirm: 'password.newConfirm',
    reenter: 'password.newReenter',
  },
} as const

export function NewPasswordFields({
  field,
  password,
  joined = false,
}: NewPasswordFieldsProps) {
  const { t } = useTranslation('auth')
  if (joined) {
    return <JoinedPasswordFields field={field} password={password} />
  }
  const label = t(LABEL_KEYS[field].label)
  const confirmLabel = t(LABEL_KEYS[field].confirm)
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
        label={confirmLabel}
        hideLabel
        type="password"
        autoComplete="new-password"
        placeholder={confirmLabel}
        required
        value={password.confirm}
        onChange={(event) => password.setConfirm(event.target.value)}
        error={password.confirmError}
      />
    </>
  )
}

function JoinedPasswordFields({
  field,
  password,
}: Omit<NewPasswordFieldsProps, 'joined'>) {
  const { t } = useTranslation('auth')
  const id = useId()
  const passwordId = `${id}-password`
  const confirmId = `${id}-confirm`
  const passwordErrorId = `${passwordId}-error`
  const confirmErrorId = `${confirmId}-error`
  const { passwordError, confirmError } = password
  const label = t(LABEL_KEYS[field].label)
  const confirmLabel = t(LABEL_KEYS[field].reenter)

  return (
    <div className="space-y-2.5">
      <div
        className={cn(
          'rounded-card bg-surface-card overflow-hidden border',
          passwordError || confirmError ? 'border-danger' : 'border-line',
        )}
      >
        <label htmlFor={passwordId} className="sr-only">
          {label}
        </label>
        <input
          id={passwordId}
          className={JOINED_FIELD}
          type="password"
          autoComplete="new-password"
          placeholder={label}
          required
          value={password.password}
          aria-invalid={passwordError ? true : undefined}
          aria-describedby={passwordError ? passwordErrorId : undefined}
          onChange={(event) => password.setPassword(event.target.value)}
        />
        <label htmlFor={confirmId} className="sr-only">
          {confirmLabel}
        </label>
        <input
          id={confirmId}
          className={cn(JOINED_FIELD, 'border-line border-t')}
          type="password"
          autoComplete="new-password"
          placeholder={confirmLabel}
          required
          value={password.confirm}
          aria-invalid={confirmError ? true : undefined}
          aria-describedby={confirmError ? confirmErrorId : undefined}
          onChange={(event) => password.setConfirm(event.target.value)}
        />
      </div>

      {passwordError && (
        <p id={passwordErrorId} className="text-danger text-caption">
          {passwordError}
        </p>
      )}
      {confirmError && (
        <p id={confirmErrorId} className="text-danger text-caption">
          {confirmError}
        </p>
      )}
    </div>
  )
}
