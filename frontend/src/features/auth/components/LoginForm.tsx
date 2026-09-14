import { useState } from 'react'
import { Link } from 'react-router'

import { ROUTES } from '@/shared/config/routes'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'

import { AuthCard } from './AuthCard'

/**
 * 로그인 (와이어프레임 A28 좌측 카드 — COM-02)
 *
 * TODO: 백엔드 인증 API 확정 후 useMutation 연결 + authStore.setAccessToken
 */
export function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  return (
    <AuthCard title="로그인">
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault()
          // TODO: 로그인 API 연결
        }}
      >
        <Input
          label="이메일"
          hideLabel
          type="email"
          autoComplete="email"
          placeholder="이메일"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <Input
          label="비밀번호"
          hideLabel
          type="password"
          autoComplete="current-password"
          placeholder="비밀번호"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <Button type="submit" fullWidth>
          로그인
        </Button>
      </form>

      <div className="text-caption flex items-center justify-between">
        <Link to={ROUTES.SIGNUP} className="text-ink-muted hover:text-ink">
          회원가입 →
        </Link>
        {/* 와이어프레임 A31: "A28 진입점 필요" — 여기가 그 진입점입니다 */}
        <Link
          to={ROUTES.PASSWORD_RESET}
          className="text-ink-muted hover:text-ink"
        >
          비밀번호 찾기
        </Link>
      </div>
    </AuthCard>
  )
}
