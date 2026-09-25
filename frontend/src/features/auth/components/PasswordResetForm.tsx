import { useState } from 'react'

import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'

import { AUTH_SUBMIT } from '../frame'
import { useNewPassword } from '../hooks/useNewPassword'
import { PASSWORD_MIN_LENGTH } from '../types'

import { AuthCard } from './AuthCard'
import { BackToLogin } from './BackToLogin'
import { NewPasswordFields } from './NewPasswordFields'

export function PasswordFindForm() {
  const [sentTo, setSentTo] = useState<string | null>(null)

  if (sentTo !== null) {
    return (
      <AuthCard
        title="메일을 보냈습니다"
        description="받은 메일함의 링크로 비밀번호를 다시 정하세요"
      >
        <p
          aria-live="polite"
          className="border-line bg-line-soft text-ink text-caption border p-2.5"
        >
          {sentTo} 으로 재설정 링크를 보냈습니다. 메일이 안 보이면 스팸함도
          확인해주세요.
        </p>

        <Button variant="outline" fullWidth onClick={() => setSentTo(null)}>
          다른 이메일로 다시 받기
        </Button>

        <BackToLogin />
      </AuthCard>
    )
  }

  return (
    <AuthCard
      title="비밀번호 찾기"
      description="가입한 이메일로 재설정 링크를 보냅니다"
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
          label="이메일"
          hideLabel
          name="email"
          type="email"
          autoComplete="email"
          placeholder="이메일"
          required
        />
        <Button type="submit" fullWidth className={AUTH_SUBMIT}>
          메일 받기
        </Button>
      </form>

      <BackToLogin />
    </AuthCard>
  )
}

export function PasswordResetForm() {
  const password = useNewPassword()

  return (
    <AuthCard
      title="비밀번호 재설정"
      description="새로 쓸 비밀번호를 정해주세요"
    >
      <form
        className="space-y-2.5"
        onSubmit={(event) => {
          event.preventDefault()
          // NOTE: 서버에 붙이지 않습니다 — 백엔드에 재설정 API 가 없습니다.
        }}
      >
        <NewPasswordFields label="새 비밀번호" password={password} />

        <p className="text-ink-muted text-caption">
          비밀번호는 {PASSWORD_MIN_LENGTH}자 이상이어야 합니다.
        </p>

        <Button
          type="submit"
          fullWidth
          className={AUTH_SUBMIT}
          disabled={!password.valid}
        >
          변경하고 로그인
        </Button>
      </form>

      <BackToLogin />
    </AuthCard>
  )
}
