import { useMutation, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
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
      title="회원 탈퇴"
      footer={
        <>
          <Button variant="outline" onClick={close}>
            취소
          </Button>
          <Button
            variant="danger"
            disabled={!canWithdraw}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? '탈퇴 중' : '탈퇴'}
          </Button>
        </>
      }
    >
      <div className="space-y-2.5">
        <div className="border-line bg-line-soft text-ink text-caption space-y-1.25 border p-2.5 leading-relaxed">
          <p>진열대 · 컬렉션 · 메모가 함께 삭제됩니다.</p>
          <p>
            작성한 게시글 · 댓글 · 후기는{' '}
            <b>작성자 표시만 지워지고 남습니다.</b>
          </p>
          <p>계정은 바로 삭제되며 되돌릴 수 없습니다.</p>
        </div>

        <label className="flex cursor-pointer items-center gap-2.5">
          <Checkbox
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
          />
          <span className="text-ink text-xs">위 내용을 확인했습니다</span>
        </label>

        {kind === 'loading' ? (
          <p className="text-ink-muted text-caption">
            계정 정보를 확인하고 있습니다.
          </p>
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
            label="현재 비밀번호"
            type="password"
            autoComplete="current-password"
            placeholder="현재 비밀번호"
            hint="본인 확인을 위해 한 번 더 입력해주세요."
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        )}

        {(mutation.error ?? reauth.error) !== null && (
          <p className="text-danger text-caption" role="alert">
            {apiErrorMessage(
              mutation.error ?? reauth.error,
              '탈퇴하지 못했습니다. 잠시 후 다시 시도해주세요.',
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
  if (!env.googleLoginEnabled) {
    return (
      <p className="text-danger text-caption" role="alert">
        지금은 Google 로 본인 확인을 할 수 없어 탈퇴할 수 없습니다.
      </p>
    )
  }
  if (confirmed) {
    return <p className="text-ink text-caption">Google 계정을 확인했습니다.</p>
  }

  return (
    <div className="space-y-1.25">
      <p className="text-ink-muted text-caption">
        본인 확인을 위해 가입한 Google 계정으로 한 번 더 로그인해주세요.
      </p>
      <GoogleLoginButton onClick={onStart} disabled={pending}>
        Google 계정으로 확인
      </GoogleLoginButton>
      {failure !== null && (
        <p className="text-danger text-caption" role="alert">
          {failure}
        </p>
      )}
    </div>
  )
}
