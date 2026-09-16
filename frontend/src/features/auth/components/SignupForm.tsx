import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate } from 'react-router'

import {
  EMPTY_TERMS,
  hasAgreedRequired,
  type TermsState,
} from '@/features/auth/terms'
import { isApiError } from '@/shared/api/http'
import { ROUTES } from '@/shared/config/routes'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'

import { checkNicknameAvailability, signup } from '../api'
import {
  NICKNAME_MAX_LENGTH,
  NICKNAME_MIN_LENGTH,
  PASSWORD_MIN_LENGTH,
} from '../types'

import { AuthCard } from './AuthCard'
import { TermsAgreement } from './TermsAgreement'

/**
 * 회원가입 (와이어프레임 A28 우측 카드 + A32 동의 블록 — COM-01)
 *
 * **[중복 확인] 은 닉네임에만 답니다.** 이메일 중복 확인 엔드포인트가 없어서,
 * 이메일이 겹치는지는 [가입하기] 를 눌러 409 를 받아야 알 수 있습니다.
 *
 * 가입해도 로그인은 되지 않습니다 — 응답에 토큰이 없어 로그인 화면으로 보냅니다.
 */
export function SignupForm() {
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [nickname, setNickname] = useState('')
  const [terms, setTerms] = useState<TermsState>(EMPTY_TERMS)

  /** 중복 확인 결과. 닉네임을 고치면 지웁니다 — 옛 답이 남으면 거짓말이 됩니다 */
  const [nicknameAvailable, setNicknameAvailable] = useState<boolean | null>(
    null,
  )

  // 서버가 앞뒤 공백을 지우고 검사하므로 화면도 같은 값으로 셉니다
  const trimmedNickname = nickname.trim()
  const nicknameTooShort = trimmedNickname.length < NICKNAME_MIN_LENGTH

  const passwordError =
    password.length > 0 && password.length < PASSWORD_MIN_LENGTH
      ? `비밀번호는 ${PASSWORD_MIN_LENGTH}자 이상이어야 합니다`
      : undefined

  const passwordConfirmError =
    passwordConfirm.length > 0 && passwordConfirm !== password
      ? '비밀번호가 서로 다릅니다'
      : undefined

  const nicknameError =
    trimmedNickname.length > 0 &&
    (nicknameTooShort || trimmedNickname.length > NICKNAME_MAX_LENGTH)
      ? `닉네임은 공백을 제외하고 ${NICKNAME_MIN_LENGTH}~${NICKNAME_MAX_LENGTH}자입니다`
      : undefined

  const nicknameCheck = useMutation({
    mutationFn: () => checkNicknameAvailability(trimmedNickname),
    onSuccess: (available) => setNicknameAvailable(available),
  })

  const signupMutation = useMutation({
    mutationFn: () => signup({ email, password, nickname: trimmedNickname }),
    onSuccess: () =>
      navigate(ROUTES.LOGIN, { replace: true, state: { signedUp: true } }),
  })

  const canSubmit =
    hasAgreedRequired(terms) &&
    email.length > 0 &&
    password.length >= PASSWORD_MIN_LENGTH &&
    passwordConfirm === password &&
    !nicknameTooShort &&
    nicknameError === undefined &&
    !signupMutation.isPending

  return (
    <AuthCard
      title="회원가입"
      className="max-w-105"
      notes={[
        '이메일 형식 · 비밀번호 정책 검증',
        '이메일 · 닉네임은 다른 계정과 겹칠 수 없습니다 — 가입할 때 최종 확인합니다',
        '필수 미동의 시 [가입하기] 비활성',
        '약관 전문 화면은 별도 · 항목 구성은 법무 확인 필요',
      ]}
    >
      <form
        className="space-y-2.5"
        onSubmit={(event) => {
          event.preventDefault()
          signupMutation.mutate()
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
          autoComplete="new-password"
          placeholder="비밀번호"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={passwordError}
        />
        <Input
          label="비밀번호 확인"
          hideLabel
          type="password"
          autoComplete="new-password"
          placeholder="비밀번호 확인"
          required
          value={passwordConfirm}
          onChange={(event) => setPasswordConfirm(event.target.value)}
          error={passwordConfirmError}
        />

        {/* 중복 확인은 닉네임에만 답니다 — 와이어프레임에서 한 줄에 붙어 있습니다 */}
        <div className="flex items-start gap-1.25">
          <div className="flex-1">
            <Input
              label="닉네임"
              hideLabel
              placeholder="닉네임"
              required
              value={nickname}
              onChange={(event) => {
                setNickname(event.target.value)
                setNicknameAvailable(null)
              }}
              error={
                nicknameError ??
                (nicknameAvailable === false
                  ? '이미 사용 중인 닉네임입니다'
                  : undefined)
              }
              hint={
                nicknameAvailable === true
                  ? '사용할 수 있는 닉네임입니다'
                  : undefined
              }
            />
          </div>
          <button
            type="button"
            disabled={
              nicknameTooShort ||
              nicknameError !== undefined ||
              nicknameCheck.isPending
            }
            onClick={() => nicknameCheck.mutate()}
            className="border-line text-ink hover:bg-line-soft h-10 shrink-0 border px-2.5 text-[11px] disabled:opacity-50"
          >
            중복 확인
          </button>
        </div>

        <TermsAgreement value={terms} onChange={setTerms} />

        {signupMutation.error !== null && (
          <p className="text-danger text-caption" role="alert">
            {isApiError(signupMutation.error)
              ? signupMutation.error.message
              : '가입하지 못했습니다. 잠시 후 다시 시도해주세요.'}
          </p>
        )}

        <Button type="submit" fullWidth disabled={!canSubmit}>
          {signupMutation.isPending ? '가입 중' : '가입하기'}
        </Button>
      </form>
    </AuthCard>
  )
}
