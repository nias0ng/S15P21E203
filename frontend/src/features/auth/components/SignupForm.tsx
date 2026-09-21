import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'

import { isApiError } from '@/shared/api/http'
import { ROUTES } from '@/shared/config/routes'
import {
  RETURN_PATH_PARAM,
  safeReturnPath,
  withReturnPath,
} from '@/shared/lib/returnPath'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'

import {
  checkEmailAvailability,
  checkNicknameAvailability,
  signup,
} from '../api'
import {
  NICKNAME_MAX_LENGTH,
  NICKNAME_MIN_LENGTH,
  PASSWORD_MIN_LENGTH,
} from '../types'

import { AuthCard } from './AuthCard'
import { EmailField } from './EmailField'

/**
 * 회원가입 (A28 우측 카드 — COM-01). 이메일 · 닉네임 둘 다 [중복 확인] 이 있지만
 * "쓸 수 있다" 고 해도 가입 시점에 409 로 한 번 더 걸립니다. 가입해도 로그인은
 * 되지 않습니다 — 응답에 토큰이 없습니다.
 */
export function SignupForm() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  /** 로그인 유도 모달이 달아 준, 가입 · 로그인을 마치고 돌아갈 자리 */
  const returnTo = safeReturnPath(searchParams.get(RETURN_PATH_PARAM))

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [nickname, setNickname] = useState('')

  /** 중복 확인 결과. 값을 고치면 지웁니다 — 옛 답이 남으면 거짓말이 됩니다 */
  const [nicknameAvailable, setNicknameAvailable] = useState<boolean | null>(
    null,
  )
  const [emailAvailable, setEmailAvailable] = useState<boolean | null>(null)

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

  /*
    서버가 앞뒤 공백을 떼고 소문자로 바꿔 검사합니다. 화면이 다르게 다듬으면
    "쓸 수 있다" 고 해 놓고 가입에서 막힙니다 — 보낼 때도 같은 값을 씁니다.
  */
  const emailCheck = useMutation({
    mutationFn: () => checkEmailAvailability(email.trim()),
    onSuccess: (available) => setEmailAvailable(available),
  })

  const signupMutation = useMutation({
    mutationFn: () => signup({ email, password, nickname: trimmedNickname }),
    /*
      가입이 끝나면 로그인으로 넘기면서 **돌아갈 경로를 같이 들려 보냅니다.**
      로그인 유도 모달에서 [회원가입] 으로 들어온 사람은 원래 하려던 일이 있는데,
      여기서 경로를 흘리면 로그인까지 마치고 홈에 떨어집니다.
    */
    onSuccess: () =>
      navigate(withReturnPath(ROUTES.LOGIN, returnTo), {
        replace: true,
        state: { signedUp: true },
      }),
  })

  const canSubmit =
    email.length > 0 &&
    password.length >= PASSWORD_MIN_LENGTH &&
    passwordConfirm === password &&
    !nicknameTooShort &&
    nicknameError === undefined &&
    !signupMutation.isPending

  return (
    <AuthCard title="회원가입" className="max-w-105">
      <form
        className="space-y-2.5"
        onSubmit={(event) => {
          event.preventDefault()
          signupMutation.mutate()
        }}
      >
        {/*
          닉네임과 같은 모양 — 칸 옆에 [중복 확인] 이 붙습니다. 다만 이메일은 안이
          아이디 · `@` · 도메인 셋으로 나뉘어 있어 `EmailField` 가 그 줄을 맡습니다
          (도메인을 직접 적을 때는 아랫줄이 하나 더 생깁니다).
        */}
        <div className="flex items-start gap-1.25">
          <div className="min-w-0 flex-1">
            <EmailField
              onChange={(next) => {
                setEmail(next)
                setEmailAvailable(null)
              }}
              error={
                emailAvailable === false
                  ? '이미 사용 중인 이메일입니다'
                  : undefined
              }
              hint={
                emailAvailable === true
                  ? '사용할 수 있는 이메일입니다'
                  : undefined
              }
            />
          </div>
          <button
            type="button"
            disabled={email.trim().length === 0 || emailCheck.isPending}
            onClick={() => emailCheck.mutate()}
            className="border-line text-ink hover:bg-line-soft h-10 shrink-0 border px-2.5 text-[11px] disabled:opacity-50"
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

        {/* 와이어프레임에서 입력칸과 [중복 확인] 이 한 줄에 붙어 있습니다 */}
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
