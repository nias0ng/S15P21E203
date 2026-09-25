import { useState } from 'react'

import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'

import { AUTH_SUBMIT } from '../frame'
import { useNewPassword } from '../hooks/useNewPassword'
import { PASSWORD_MIN_LENGTH } from '../types'

import { AuthCard } from './AuthCard'
import { BackToLogin } from './BackToLogin'
import { NewPasswordFields } from './NewPasswordFields'

/** 비밀번호 찾기 (A31 좌측). 보낸 뒤 폼을 안내로 바꿉니다 — 폼이 남으면 보냈는지가 흐려져 같은 메일을 몇 번씩 부릅니다 */
export function PasswordFindForm() {
  const [sentTo, setSentTo] = useState<string | null>(null)

  if (sentTo !== null) {
    return (
      <AuthCard
        title="메일을 보냈습니다"
        description="받은 메일함의 링크로 비밀번호를 다시 정하세요"
      >
        {/* 폼 제출 결과라 화면 낭독기에도 알립니다 */}
        <p
          aria-live="polite"
          className="border-line bg-line-soft text-ink text-caption border p-2.5"
        >
          {sentTo} 으로 재설정 링크를 보냈습니다. 메일이 안 보이면 스팸함도
          확인해주세요.
        </p>

        {/* 여기서 바로 다시 보내지 않고 폼으로 되돌립니다 — 주소를 잘못 적어 못 받는 경우가 대부분입니다 */}
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
          // 메일은 가지 않고 아래 안내 화면으로만 바뀝니다
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

/**
 * 비밀번호 재설정 (A31 우측 — 메일 링크로 진입). 규칙 · 문구는
 * `PasswordChangeModal` 과 같은 것을 씁니다.
 */
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
          // 눌러도 아무 일도 일어나지 않습니다
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
