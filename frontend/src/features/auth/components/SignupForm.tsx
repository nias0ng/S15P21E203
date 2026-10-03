import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router'

import { apiErrorMessage, isApiError } from '@/shared/api/http'
import { ROUTES } from '@/shared/config/routes'
import {
  RETURN_PATH_PARAM,
  safeReturnPath,
  withReturnPath,
} from '@/shared/lib/returnPath'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'

import { checkNicknameAvailability, signup } from '../api'
import { AUTH_SUBMIT } from '../frame'
import { useAvailabilityCheck } from '../hooks/useAvailabilityCheck'
import { useEmailVerification } from '../hooks/useEmailVerification'
import { useNewPassword } from '../hooks/useNewPassword'
import { nicknameLengthError } from '../lib/nickname'
import { formatCountdown } from '../lib/verification'
import { EMAIL_VERIFICATION_CODE_LENGTH, NICKNAME_MIN_LENGTH } from '../types'

import { AuthCard } from './AuthCard'
import { BackToLogin } from './BackToLogin'
import { EmailField } from './EmailField'
import { GoogleLoginSection } from './GoogleLoginSection'
import { NewPasswordFields } from './NewPasswordFields'

export function SignupForm() {
  const { t } = useTranslation('auth')
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const returnTo = safeReturnPath(searchParams.get(RETURN_PATH_PARAM))

  const [email, setEmail] = useState('')
  const password = useNewPassword()
  const [nickname, setNickname] = useState('')

  const trimmedEmail = email.trim()
  const trimmedNickname = nickname.trim()
  const nicknameTooShort = trimmedNickname.length < NICKNAME_MIN_LENGTH

  const verification = useEmailVerification(trimmedEmail)
  const nicknameCheck = useAvailabilityCheck(
    checkNicknameAvailability,
    trimmedNickname,
  )
  const emailToken = verification.token
  const nicknameAvailable = nicknameCheck.available

  const nicknameError = nicknameLengthError(trimmedNickname)

  const signupMutation = useMutation({
    mutationFn: (emailVerificationToken: string) =>
      signup({
        email: trimmedEmail,
        password: password.password,
        nickname: trimmedNickname,
        emailVerificationToken,
      }),
    onSuccess: () =>
      navigate(withReturnPath(ROUTES.LOGIN, returnTo), {
        replace: true,
        state: { signedUp: true },
      }),
    onError: (error) => {
      if (!isApiError(error)) {
        return
      }
      // 토큰이 죽었거나 그 사이 누가 이 이메일로 가입했습니다. 처음부터 다시 인증받게 합니다
      if (
        error.code === 'AUTH_EMAIL_NOT_VERIFIED' ||
        error.code === 'AUTH_EMAIL_ALREADY_EXISTS'
      ) {
        verification.reset()
      }
      if (error.code === 'AUTH_NICKNAME_ALREADY_EXISTS') {
        nicknameCheck.markTaken()
      }
      // 토큰은 가입이 성공해야 폐기되므로 인증은 그대로 두고 닉네임만 다시 확인받습니다
      if (error.code === 'AUTH_SIGNUP_CONFLICT') {
        nicknameCheck.reset()
      }
    },
  })

  const canSubmit =
    email.length > 0 &&
    password.valid &&
    !nicknameTooShort &&
    nicknameError === undefined &&
    emailToken !== null &&
    nicknameAvailable === true &&
    !signupMutation.isPending

  return (
    <AuthCard title={t('signup.title')} large>
      <form
        className="space-y-2.5"
        onSubmit={(event) => {
          event.preventDefault()
          if (!canSubmit) {
            return
          }
          signupMutation.mutate(emailToken)
        }}
      >
        <div className="flex items-start gap-1.25">
          <div className="min-w-0 flex-1">
            <EmailField
              onChange={(next) => {
                setEmail(next)
                // 인증은 주소 하나에 묶입니다. 한 글자라도 바뀌면 번호 · 타이머까지 다시 시작합니다
                if (next.trim() !== trimmedEmail) {
                  verification.reset()
                }
              }}
              error={verification.sendError}
              hint={
                emailToken !== null
                  ? t('signup.verified')
                  : verification.sent
                    ? undefined
                    : trimmedEmail.length > 0
                      ? t('signup.sendPrompt')
                      : undefined
              }
            />
          </div>
          <Button
            variant="outline"
            type="button"
            className="shrink-0"
            disabled={!verification.canSend}
            isLoading={verification.isSending && !verification.sent}
            onClick={verification.send}
          >
            {t('signup.send')}
          </Button>
        </div>

        {verification.sent && emailToken === null && (
          <div className="flex items-start gap-1.25">
            <div className="relative min-w-0 flex-1">
              <Input
                className="pr-15"
                label={t('signup.codeLabel')}
                hideLabel
                placeholder={t('signup.codePlaceholder', {
                  length: EMAIL_VERIFICATION_CODE_LENGTH,
                })}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={EMAIL_VERIFICATION_CODE_LENGTH}
                value={verification.code}
                disabled={!verification.codeUsable}
                onChange={(event) =>
                  verification.changeCode(event.target.value)
                }
                onKeyDown={(event) => {
                  // 번호 칸에서 Enter 는 가입이 아니라 번호 확인입니다
                  if (event.key !== 'Enter') {
                    return
                  }
                  event.preventDefault()
                  if (verification.canConfirm) {
                    verification.confirm()
                  }
                }}
                error={verification.codeError}
                hint={t('signup.codeSent')}
              />
              {verification.codeRemaining !== null && (
                // 번호 칸 오른쪽 끝에 얹습니다. 라벨이 sr-only 라 칸의 윗변이 이 상자의 윗변입니다
                <span
                  role="timer"
                  aria-label={t('signup.timeLeft', {
                    time: formatCountdown(verification.codeRemaining),
                  })}
                  className="text-danger text-caption pointer-events-none absolute top-0 right-2.5 flex h-10 items-center tabular-nums"
                >
                  {formatCountdown(verification.codeRemaining)}
                </span>
              )}
            </div>
            {verification.needsResend ? (
              <Button
                variant="outline"
                type="button"
                className="shrink-0"
                disabled={!verification.canResend}
                isLoading={verification.isSending}
                onClick={verification.send}
              >
                {t('signup.resend')}
              </Button>
            ) : (
              <Button
                variant="outline"
                type="button"
                className="shrink-0"
                disabled={!verification.canConfirm}
                isLoading={verification.isConfirming}
                onClick={verification.confirm}
              >
                {t('signup.confirm')}
              </Button>
            )}
          </div>
        )}

        <NewPasswordFields field="password" password={password} joined />

        <div className="flex items-start gap-1.25">
          <div className="min-w-0 flex-1">
            <Input
              label={t('nickname.label')}
              hideLabel
              placeholder={t('nickname.label')}
              required
              value={nickname}
              onChange={(event) => setNickname(event.target.value)}
              error={
                nicknameError ??
                (nicknameAvailable === false ? t('nickname.taken') : undefined)
              }
              hint={
                nicknameAvailable === true
                  ? t('nickname.available')
                  : !nicknameTooShort
                    ? t('nickname.checkPrompt')
                    : undefined
              }
            />
          </div>
          <Button
            variant="outline"
            type="button"
            className="shrink-0"
            disabled={
              nicknameTooShort ||
              nicknameError !== undefined ||
              nicknameCheck.isPending
            }
            onClick={nicknameCheck.check}
          >
            {t('nickname.check')}
          </Button>
        </div>

        {signupMutation.error !== null && (
          <p className="text-danger text-caption" role="alert">
            {apiErrorMessage(signupMutation.error, t('signup.failed'))}
          </p>
        )}

        <Button
          type="submit"
          fullWidth
          disabled={!canSubmit}
          className={AUTH_SUBMIT}
        >
          {signupMutation.isPending
            ? t('signup.submitting')
            : t('signup.submit')}
        </Button>
      </form>

      <GoogleLoginSection
        label={t('google.signupButton')}
        returnTo={returnTo}
      />

      <BackToLogin returnTo={returnTo} />
    </AuthCard>
  )
}
