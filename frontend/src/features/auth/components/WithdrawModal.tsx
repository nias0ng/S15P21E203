import { useMutation, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'

import { apiErrorMessage, isApiError } from '@/shared/api/http'
import { env } from '@/shared/config/env'
import { ROUTES } from '@/shared/config/routes'
import { useEndSession } from '@/shared/hooks/useEndSession'
import { useIsLoggedIn } from '@/shared/store/authStore'
import { Button } from '@/shared/ui/Button'
import { Checkbox } from '@/shared/ui/Checkbox'
import { Input } from '@/shared/ui/Input'
import { Modal } from '@/shared/ui/Modal'

import { startGoogleReauth, withdraw } from '../api'
import { googleErrorMessage } from '../lib/googleErrors'
import { meQuery } from '../queries'

import { GoogleLoginButton } from './GoogleLoginButton'

type Props = {
  open: boolean
  onClose: () => void
  /*
   * Google 재확인을 마치고 돌아왔을 때 주소의 `?googleReauth=` 값입니다. `ok` 면 확인을 마친 것이고,
   * 그 밖의 값은 실패 코드입니다.
   */
  googleReauth?: string | null
}

export function WithdrawModal({ open, onClose, googleReauth = null }: Props) {
  const { t } = useTranslation('auth')
  const navigate = useNavigate()
  const endSession = useEndSession()
  const isLoggedIn = useIsLoggedIn()
  const { data: me } = useQuery({ ...meQuery(), enabled: isLoggedIn })

  const [confirmed, setConfirmed] = useState(false)
  const [password, setPassword] = useState('')
  // 서버의 재확인 표시는 한 번 쓰면 사라집니다. 실패한 뒤에는 다시 확인받아야 합니다.
  const [reauthSpent, setReauthSpent] = useState(false)
  // 서버가 "Google 재확인이 필요하다" 고 답했다면 내 정보가 무엇이라 하든 Google 계정입니다.
  const [serverSaysGoogle, setServerSaysGoogle] = useState(false)
  const googleConfirmed = googleReauth === 'ok' && !reauthSpent

  // NOTE: 계정 종류를 짐작하지 않습니다. 내 정보를 받기 전에 비밀번호 칸을 띄우면 Google 계정인
  // 사람이 아무 값이나 넣고 탈퇴를 누르게 되고, 서버가 막아도 Google 확인 버튼이 끝내 안 나옵니다.
  const kind: 'loading' | 'password' | 'google' =
    serverSaysGoogle || me?.hasPassword === false
      ? 'google'
      : me === undefined
        ? 'loading'
        : 'password'
  const googleOnly = kind === 'google'

  const mutation = useMutation({
    mutationFn: () => withdraw(googleOnly ? null : password),
    onSuccess: () => {
      endSession()
      navigate(ROUTES.HOME, { replace: true })
    },
    onError: (error) => {
      if (isApiError(error) && error.code === 'AUTH_GOOGLE_REAUTH_REQUIRED') {
        setReauthSpent(true)
        setServerSaysGoogle(true)
      }
    },
  })

  const reauth = useMutation({
    mutationFn: startGoogleReauth,
    // 페이지를 Google 로그인 화면으로 넘깁니다. 확인이 끝나면 정보 변경 화면으로 돌아옵니다.
    onSuccess: (authorizationUrl) => window.location.assign(authorizationUrl),
  })

  const close = () => {
    setConfirmed(false)
    setPassword('')
    mutation.reset()
    reauth.reset()
    onClose()
  }

  const identified =
    kind === 'google'
      ? googleConfirmed
      : kind === 'password' && password.length > 0
  const canWithdraw = confirmed && identified && !mutation.isPending

  return (
    <Modal
      open={open}
      onClose={close}
      title={t('withdraw.title')}
      footer={
        <>
          <Button variant="outline" onClick={close}>
            {t('actions.cancel')}
          </Button>
          <Button
            variant="danger"
            disabled={!canWithdraw}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending
              ? t('withdraw.submitting')
              : t('withdraw.submit')}
          </Button>
        </>
      }
    >
      <div className="space-y-2.5">
        <div className="border-line bg-line-soft text-ink text-caption space-y-1.25 border p-2.5 leading-relaxed">
          <p>{t('withdraw.noticeDeleted')}</p>
          <p>
            {t('withdraw.noticePostsLead')}{' '}
            <b>{t('withdraw.noticePostsKept')}</b>
          </p>
          <p>{t('withdraw.noticeFinal')}</p>
        </div>

        <label className="flex cursor-pointer items-center gap-2.5">
          <Checkbox
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
          />
          <span className="text-ink text-xs">{t('withdraw.agree')}</span>
        </label>

        {kind === 'loading' ? (
          <p className="text-ink-muted text-caption">{t('withdraw.loading')}</p>
        ) : kind === 'google' ? (
          <GoogleConfirm
            confirmed={googleConfirmed}
            failure={
              googleReauth !== 'ok' ? googleErrorMessage(googleReauth) : null
            }
            pending={reauth.isPending}
            onStart={() => reauth.mutate()}
          />
        ) : (
          <Input
            label={t('password.current')}
            type="password"
            autoComplete="current-password"
            placeholder={t('password.current')}
            hint={t('withdraw.passwordHint')}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        )}

        {(mutation.error ?? reauth.error) !== null && (
          <p className="text-danger text-caption" role="alert">
            {apiErrorMessage(
              mutation.error ?? reauth.error,
              t('withdraw.failed'),
            )}
          </p>
        )}
      </div>
    </Modal>
  )
}

function GoogleConfirm({
  confirmed,
  failure,
  pending,
  onStart,
}: {
  confirmed: boolean
  failure: string | null
  pending: boolean
  onStart: () => void
}) {
  const { t } = useTranslation('auth')
  if (!env.googleLoginEnabled) {
    return (
      <p className="text-danger text-caption" role="alert">
        {t('withdraw.googleUnavailable')}
      </p>
    )
  }
  if (confirmed) {
    return (
      <p className="text-ink text-caption">{t('withdraw.googleConfirmed')}</p>
    )
  }

  return (
    <div className="space-y-1.25">
      <p className="text-ink-muted text-caption">
        {t('withdraw.googlePrompt')}
      </p>
      <GoogleLoginButton onClick={onStart} disabled={pending}>
        {t('withdraw.googleButton')}
      </GoogleLoginButton>
      {failure !== null && (
        <p className="text-danger text-caption" role="alert">
          {failure}
        </p>
      )}
    </div>
  )
}
