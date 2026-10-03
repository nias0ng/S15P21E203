import { useMutation, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'

import { apiErrorMessage, isApiError } from '@/shared/api/http'
import { ROUTES } from '@/shared/config/routes'
import { RETURN_PATH_PARAM, safeReturnPath } from '@/shared/lib/returnPath'
import { useAuthStore } from '@/shared/store/authStore'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'

import {
  checkNicknameAvailability,
  getGoogleSignup,
  getMe,
  googleSignup,
  toAuthUser,
} from '../api'
import { AUTH_SUBMIT } from '../frame'
import { useAvailabilityCheck } from '../hooks/useAvailabilityCheck'
import { nicknameLengthError } from '../lib/nickname'
import { type GoogleSignupInfo, NICKNAME_MIN_LENGTH } from '../types'

import { AuthCard } from './AuthCard'
import { BackToLogin } from './BackToLogin'

type Props = {
  onSignedUp: (from: string) => void
}

/**
 * Google 확인을 마친 사람이 닉네임을 정해 가입을 끝내는 폼입니다.
 *
 * NOTE: 가입표는 Google 콜백이 심은 HttpOnly 쿠키라 화면이 들고 있지 않습니다. 서버에 이메일과 추천
 * 닉네임을 물어보고, 없거나 만료됐으면(주소를 직접 치고 들어온 경우 등) Google 로그인부터 다시 하라고
 * 안내합니다.
 */
export function GoogleSignupForm({ onSignedUp }: Props) {
  const { t } = useTranslation('auth')
  const [searchParams] = useSearchParams()
  const returnTo = safeReturnPath(searchParams.get(RETURN_PATH_PARAM))
  // NOTE: 다시 묻지 않습니다. 가입표가 만료되면 다시 물어도 같은 답이고, 창을 오갈 때마다 부르면
  // 닉네임을 치는 도중 폼이 새로 그려집니다.
  const { data, isPending, isError } = useQuery({
    queryKey: ['auth', 'google-signup'],
    queryFn: getGoogleSignup,
    retry: false,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  })

  if (isPending) {
    return (
      <AuthCard
        title={t('googleSignup.title')}
        description={t('googleSignup.loading')}
      />
    )
  }
  if (isError) {
    return <MissingTicket returnTo={returnTo} />
  }
  return (
    <NicknameStep signup={data} returnTo={returnTo} onSignedUp={onSignedUp} />
  )
}

function NicknameStep({
  signup,
  returnTo,
  onSignedUp,
}: {
  signup: GoogleSignupInfo
  returnTo: string | null
  onSignedUp: (from: string) => void
}) {
  const { t } = useTranslation('auth')
  const setAuth = useAuthStore((store) => store.setAuth)
  const [nickname, setNickname] = useState(signup.suggestedNickname ?? '')
  const [ticketExpired, setTicketExpired] = useState(false)

  const trimmedNickname = nickname.trim()
  const nicknameTooShort = trimmedNickname.length < NICKNAME_MIN_LENGTH
  const nicknameError = nicknameLengthError(trimmedNickname)
  const nicknameCheck = useAvailabilityCheck(
    checkNicknameAvailability,
    trimmedNickname,
  )
  const nicknameAvailable = nicknameCheck.available

  const mutation = useMutation({
    mutationFn: async () => {
      const accessToken = await googleSignup(trimmedNickname)
      useAuthStore.getState().setAccessToken(accessToken)
      return { accessToken, user: toAuthUser(await getMe()) }
    },
    onSuccess: ({ accessToken, user }) => {
      setAuth({ accessToken, user })
      onSignedUp(returnTo ?? ROUTES.HOME)
    },
    onError: (error) => {
      useAuthStore.getState().clear()
      if (!isApiError(error)) {
        return
      }
      if (error.code === 'AUTH_NICKNAME_ALREADY_EXISTS') {
        nicknameCheck.markTaken()
      }
      if (error.code === 'AUTH_INVALID_GOOGLE_SIGNUP_TICKET') {
        setTicketExpired(true)
      }
    },
  })

  if (ticketExpired) {
    return <MissingTicket returnTo={returnTo} expired />
  }

  const canSubmit =
    !nicknameTooShort &&
    nicknameError === undefined &&
    nicknameAvailable === true &&
    !mutation.isPending

  return (
    <AuthCard
      title={t('googleSignup.title')}
      description={t('googleSignup.description')}
    >
      <p className="border-line bg-line-soft text-ink text-caption border p-2.5">
        {signup.email}
      </p>

      <form
        className="space-y-2.5"
        onSubmit={(event) => {
          event.preventDefault()
          if (canSubmit) {
            mutation.mutate()
          }
        }}
      >
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

        {mutation.error !== null && (
          <p className="text-danger text-caption" role="alert">
            {apiErrorMessage(mutation.error, t('signup.failed'))}
          </p>
        )}

        <Button
          type="submit"
          fullWidth
          disabled={!canSubmit}
          className={AUTH_SUBMIT}
        >
          {mutation.isPending ? t('signup.submitting') : t('signup.submit')}
        </Button>
      </form>
    </AuthCard>
  )
}

function MissingTicket({
  returnTo,
  expired = false,
}: {
  returnTo: string | null
  expired?: boolean
}) {
  const { t } = useTranslation('auth')
  return (
    <AuthCard
      title={t('googleSignup.title')}
      description={
        expired
          ? t('googleSignup.ticketExpired')
          : t('googleSignup.ticketMissing')
      }
    >
      <BackToLogin returnTo={returnTo} />
    </AuthCard>
  )
}
