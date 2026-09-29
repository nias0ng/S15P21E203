import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
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

import {
  checkEmailAvailability,
  checkNicknameAvailability,
  signup,
} from '../api'
import { AUTH_SUBMIT } from '../frame'
import { useAvailabilityCheck } from '../hooks/useAvailabilityCheck'
import { useNewPassword } from '../hooks/useNewPassword'
import { nicknameLengthError } from '../lib/nickname'
import { NICKNAME_MIN_LENGTH } from '../types'

import { AuthCard } from './AuthCard'
import { BackToLogin } from './BackToLogin'
import { EmailField } from './EmailField'
import { GoogleLoginSection } from './GoogleLoginSection'
import { NewPasswordFields } from './NewPasswordFields'

export function SignupForm() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const returnTo = safeReturnPath(searchParams.get(RETURN_PATH_PARAM))

  const [email, setEmail] = useState('')
  const password = useNewPassword()
  const [nickname, setNickname] = useState('')

  const trimmedEmail = email.trim()
  const trimmedNickname = nickname.trim()
  const nicknameTooShort = trimmedNickname.length < NICKNAME_MIN_LENGTH

  const emailCheck = useAvailabilityCheck(checkEmailAvailability, trimmedEmail)
  const nicknameCheck = useAvailabilityCheck(
    checkNicknameAvailability,
    trimmedNickname,
  )
  const emailAvailable = emailCheck.available
  const nicknameAvailable = nicknameCheck.available

  const nicknameError = nicknameLengthError(trimmedNickname)

  const signupMutation = useMutation({
    mutationFn: () =>
      signup({
        email: trimmedEmail,
        password: password.password,
        nickname: trimmedNickname,
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
      if (error.code === 'AUTH_EMAIL_ALREADY_EXISTS') {
        emailCheck.markTaken()
      }
      if (error.code === 'AUTH_NICKNAME_ALREADY_EXISTS') {
        nicknameCheck.markTaken()
      }
      if (error.code === 'AUTH_SIGNUP_CONFLICT') {
        emailCheck.reset()
        nicknameCheck.reset()
      }
    },
  })

  const canSubmit =
    email.length > 0 &&
    password.valid &&
    !nicknameTooShort &&
    nicknameError === undefined &&
    emailAvailable === true &&
    nicknameAvailable === true &&
    !signupMutation.isPending

  return (
    <AuthCard title="회원가입">
      <form
        className="space-y-2.5"
        onSubmit={(event) => {
          event.preventDefault()
          if (!canSubmit) {
            return
          }
          signupMutation.mutate()
        }}
      >
        <div className="flex items-start gap-1.25">
          <div className="min-w-0 flex-1">
            <EmailField
              onChange={setEmail}
              error={
                emailAvailable === false
                  ? '이미 사용 중인 이메일입니다'
                  : undefined
              }
              hint={
                emailAvailable === true
                  ? '사용할 수 있는 이메일입니다'
                  : trimmedEmail.length > 0
                    ? '[중복 확인] 을 눌러주세요'
                    : undefined
              }
            />
          </div>
          <Button
            variant="outline"
            type="button"
            className="shrink-0"
            disabled={trimmedEmail.length === 0 || emailCheck.isPending}
            onClick={emailCheck.check}
          >
            중복 확인
          </Button>
        </div>

        <NewPasswordFields label="비밀번호" password={password} />

        <div className="flex items-start gap-1.25">
          <div className="min-w-0 flex-1">
            <Input
              label="닉네임"
              hideLabel
              placeholder="닉네임"
              required
              value={nickname}
              onChange={(event) => setNickname(event.target.value)}
              error={
                nicknameError ??
                (nicknameAvailable === false
                  ? '이미 사용 중인 닉네임입니다'
                  : undefined)
              }
              hint={
                nicknameAvailable === true
                  ? '사용할 수 있는 닉네임입니다'
                  : !nicknameTooShort
                    ? '[중복 확인] 을 눌러주세요'
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
            중복 확인
          </Button>
        </div>

        {signupMutation.error !== null && (
          <p className="text-danger text-caption" role="alert">
            {apiErrorMessage(
              signupMutation.error,
              '가입하지 못했습니다. 잠시 후 다시 시도해주세요.',
            )}
          </p>
        )}

        <Button
          type="submit"
          fullWidth
          disabled={!canSubmit}
          className={AUTH_SUBMIT}
        >
          {signupMutation.isPending ? '가입 중' : '가입하기'}
        </Button>
      </form>

      <GoogleLoginSection
        label="Google 계정으로 가입하기"
        returnTo={returnTo}
      />

      <BackToLogin returnTo={returnTo} />
    </AuthCard>
  )
}
