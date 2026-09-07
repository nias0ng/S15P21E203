import { useState } from 'react'

import {
  EMPTY_TERMS,
  hasAgreedRequired,
  type TermsState,
} from '@/features/auth/terms'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'

import { AuthCard } from './AuthCard'
import { TermsAgreement } from './TermsAgreement'

/**
 * 회원가입 (와이어프레임 A28 우측 카드 + A32 동의 블록 — COM-01)
 *
 * TODO: 백엔드 인증 API 확정 후 연결
 * - 이메일 중복 확인 (별도 엔드포인트)
 * - 이메일 형식 · 비밀번호 정책 검증 (정책값은 백엔드와 맞춰야 합니다)
 */
export function SignupForm() {
  const [terms, setTerms] = useState<TermsState>(EMPTY_TERMS)
  const canSubmit = hasAgreedRequired(terms)

  return (
    <AuthCard
      title="회원가입"
      className="max-w-105"
      notes={[
        '이메일 형식 · 비밀번호 정책 검증',
        '필수 미동의 시 [가입하기] 비활성 — 비활성 표현은 팀 확정 필요',
        '약관 전문 화면은 별도 · 항목 구성은 법무 확인 필요',
      ]}
    >
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault()
          // TODO: 회원가입 API 연결
        }}
      >
        {/* 이메일 + 중복 확인 — 와이어프레임에서 한 줄에 붙어 있습니다 */}
        <div className="flex items-start gap-1.5">
          <div className="flex-1">
            <Input
              label="이메일"
              hideLabel
              type="email"
              autoComplete="email"
              placeholder="이메일"
              required
            />
          </div>
          <button
            type="button"
            className="border-line text-ink hover:bg-line-soft h-10 shrink-0 border px-3 text-[11px]"
          >
            중복 확인
          </button>
        </div>

        <Input
          label="비밀번호"
          hideLabel
          type="password"
          autoComplete="new-password"
          placeholder="비밀번호"
          required
        />
        <Input
          label="비밀번호 확인"
          hideLabel
          type="password"
          autoComplete="new-password"
          placeholder="비밀번호 확인"
          required
        />
        <Input label="닉네임" hideLabel placeholder="닉네임" required />

        <TermsAgreement value={terms} onChange={setTerms} />

        <Button type="submit" fullWidth disabled={!canSubmit}>
          가입하기
        </Button>
      </form>
    </AuthCard>
  )
}
