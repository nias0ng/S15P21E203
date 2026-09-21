import { useState } from 'react'
import { Link } from 'react-router'

import { ROUTES } from '@/shared/config/routes'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'

import { AUTH_SUBMIT } from '../frame'
import { PASSWORD_MIN_LENGTH } from '../types'

import { AuthCard } from './AuthCard'

/**
 * 로그인으로 돌아가는 줄. 두 카드가 같이 쓰고, 모양 · 자리는 `SignupForm` 의
 * [로그인하기 →] 와 같게 둡니다 — 판의 모서리가 둥글어 5px 을 들여씁니다.
 */
function BackToLogin() {
  return (
    <div className="text-caption flex items-center pl-1.25">
      <Link to={ROUTES.LOGIN} className="text-ink-muted hover:text-ink">
        로그인하기 →
      </Link>
    </div>
  )
}

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
          // TODO: 재설정 메일 발송 API 연결
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
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')

  const passwordError =
    password.length > 0 && password.length < PASSWORD_MIN_LENGTH
      ? `비밀번호는 ${PASSWORD_MIN_LENGTH}자 이상이어야 합니다`
      : undefined

  const confirmError =
    passwordConfirm.length > 0 && passwordConfirm !== password
      ? '비밀번호가 서로 다릅니다'
      : undefined

  const canSubmit =
    password.length >= PASSWORD_MIN_LENGTH && passwordConfirm === password

  return (
    <AuthCard
      title="비밀번호 재설정"
      description="새로 쓸 비밀번호를 정해주세요"
    >
      <form
        className="space-y-2.5"
        onSubmit={(event) => {
          event.preventDefault()
          // TODO: 비밀번호 재설정 API 연결 후 로그인 처리
        }}
      >
        <Input
          label="새 비밀번호"
          hideLabel
          type="password"
          autoComplete="new-password"
          placeholder="새 비밀번호"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={passwordError}
        />
        <Input
          label="새 비밀번호 확인"
          hideLabel
          type="password"
          autoComplete="new-password"
          placeholder="새 비밀번호 확인"
          required
          value={passwordConfirm}
          onChange={(event) => setPasswordConfirm(event.target.value)}
          error={confirmError}
        />

        <p className="text-ink-muted text-caption">
          비밀번호는 {PASSWORD_MIN_LENGTH}자 이상이어야 합니다.
        </p>

        <Button
          type="submit"
          fullWidth
          className={AUTH_SUBMIT}
          disabled={!canSubmit}
        >
          변경하고 로그인
        </Button>
      </form>

      <BackToLogin />
    </AuthCard>
  )
}
