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
import { useNewPassword } from '../hooks/useNewPassword'
import { NICKNAME_MAX_LENGTH, NICKNAME_MIN_LENGTH } from '../types'

import { AuthCard } from './AuthCard'
import { BackToLogin } from './BackToLogin'
import { EmailField } from './EmailField'
import { NewPasswordFields } from './NewPasswordFields'

/** 중복 확인을 마친 값과 그 답 */
type Checked = { value: string; available: boolean }

/**
 * 확인한 값과 지금 칸에 든 값이 같을 때만 답을 인정합니다.
 *
 * 값을 고칠 때 답을 지우는 방식으로는 부족합니다 — 확인 요청이 날아가 있는 사이에
 * 값을 고치면, 늦게 도착한 옛 답이 새 값에 붙습니다.
 */
function answerFor(checked: Checked | null, value: string): boolean | null {
  return checked !== null && checked.value === value ? checked.available : null
}

/**
 * 회원가입 (A28 우측 카드 — COM-01). [중복 확인] 을 통과해야 [가입하기] 가 켜지고,
 * 통과해도 가입 시점에 409 로 한 번 더 걸립니다 — 확인과 가입 사이에 남이 같은
 * 이메일 · 닉네임을 가져갈 수 있습니다. 가입해도 로그인은 되지 않습니다 — 응답에
 * 토큰이 없습니다.
 */
export function SignupForm() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  /** 로그인 유도 모달이 달아 준, 가입 · 로그인을 마치고 돌아갈 자리 */
  const returnTo = safeReturnPath(searchParams.get(RETURN_PATH_PARAM))

  const [email, setEmail] = useState('')
  const password = useNewPassword()
  const [nickname, setNickname] = useState('')

  const [emailChecked, setEmailChecked] = useState<Checked | null>(null)
  const [nicknameChecked, setNicknameChecked] = useState<Checked | null>(null)

  // 서버가 앞뒤 공백을 지우고 검사하므로 화면도 같은 값으로 셉니다
  const trimmedEmail = email.trim()
  const trimmedNickname = nickname.trim()
  const nicknameTooShort = trimmedNickname.length < NICKNAME_MIN_LENGTH

  const emailAvailable = answerFor(emailChecked, trimmedEmail)
  const nicknameAvailable = answerFor(nicknameChecked, trimmedNickname)

  const nicknameError =
    trimmedNickname.length > 0 &&
    (nicknameTooShort || trimmedNickname.length > NICKNAME_MAX_LENGTH)
      ? `닉네임은 공백을 제외하고 ${NICKNAME_MIN_LENGTH}~${NICKNAME_MAX_LENGTH}자입니다`
      : undefined

  const nicknameCheck = useMutation({
    mutationFn: (value: string) => checkNicknameAvailability(value),
    onSuccess: (available, value) => setNicknameChecked({ value, available }),
  })

  const emailCheck = useMutation({
    mutationFn: (value: string) => checkEmailAvailability(value),
    onSuccess: (available, value) => setEmailChecked({ value, available }),
  })

  const signupMutation = useMutation({
    mutationFn: () =>
      signup({
        email: trimmedEmail,
        password: password.password,
        nickname: trimmedNickname,
      }),
    // 돌아갈 경로를 로그인까지 들려 보냅니다 — 흘리면 로그인을 마치고 홈에 떨어집니다
    onSuccess: () =>
      navigate(withReturnPath(ROUTES.LOGIN, returnTo), {
        replace: true,
        state: { signedUp: true },
      }),
    // 확인을 통과했어도 서버가 중복이라 하면 들고 있던 답이 거짓이 된 것입니다.
    // 그 자리에서 뒤집어, 다시 확인하기 전에는 [가입하기] 가 켜지지 않게 합니다.
    onError: (error) => {
      if (!isApiError(error)) {
        return
      }
      if (error.code === 'AUTH_EMAIL_ALREADY_EXISTS') {
        setEmailChecked({ value: trimmedEmail, available: false })
      }
      if (error.code === 'AUTH_NICKNAME_ALREADY_EXISTS') {
        setNicknameChecked({ value: trimmedNickname, available: false })
      }
      // 서버도 어느 쪽인지 가리지 않은 경우입니다 — 둘 다 다시 확인해야 합니다
      if (error.code === 'AUTH_SIGNUP_CONFLICT') {
        setEmailChecked(null)
        setNicknameChecked(null)
      }
    },
  })

  const canSubmit =
    email.length > 0 &&
    password.valid &&
    !nicknameTooShort &&
    nicknameError === undefined &&
    // 중복 확인을 마쳐야 켭니다. 서버는 어차피 409 로 막지만, 그때는 이미 누른
    // 뒤라 비밀번호 두 칸을 다시 적게 됩니다.
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
            onClick={() => emailCheck.mutate(trimmedEmail)}
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
            onClick={() => nicknameCheck.mutate(trimmedNickname)}
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

      {/* 돌아갈 경로를 들고 갑니다 — 가입하려다 말고 로그인으로 가는 사람이 있습니다 */}
      <BackToLogin returnTo={returnTo} />
    </AuthCard>
  )
}
