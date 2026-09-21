import { useState } from 'react'

import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'

import { AuthCard } from './AuthCard'

/**
 * 비밀번호 찾기 (와이어프레임 A31 좌측 카드)
 * 메일을 보낸 뒤에는 안내 문구로 바뀝니다.
 */
export function PasswordFindForm() {
  const [sent, setSent] = useState(false)

  return (
    <AuthCard
      eyebrow="찾기"
      title="비밀번호 찾기"
      description="가입한 이메일로 재설정 링크를 보냅니다"
    >
      <form
        className="space-y-2.5"
        onSubmit={(event) => {
          event.preventDefault()
          // TODO: 재설정 메일 발송 API 연결
          setSent(true)
        }}
      >
        <Input
          label="이메일"
          hideLabel
          type="email"
          autoComplete="email"
          placeholder="이메일"
          required
        />
        <Button type="submit" fullWidth>
          메일 받기
        </Button>
      </form>

      {sent && (
        <p
          // 폼 제출 결과라 화면 낭독기에도 알려야 합니다
          aria-live="polite"
          className="border-line text-ink border p-2.5 text-[11px]"
        >
          메일을 보냈습니다. 받은 메일함을 확인해주세요.
        </p>
      )}
    </AuthCard>
  )
}

/**
 * 비밀번호 재설정 (와이어프레임 A31 우측 카드 — 메일 링크로 진입)
 * 메일 링크의 토큰을 쿼리스트링으로 받는 화면입니다.
 */
export function PasswordResetForm() {
  return (
    <AuthCard eyebrow="재설정 (메일 링크 진입)" title="비밀번호 재설정">
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
        />
        <Input
          label="새 비밀번호 확인"
          hideLabel
          type="password"
          autoComplete="new-password"
          placeholder="새 비밀번호 확인"
          required
        />
        <Button type="submit" fullWidth>
          변경하고 로그인
        </Button>
      </form>
    </AuthCard>
  )
}
