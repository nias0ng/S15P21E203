import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'

import { env } from '@/shared/config/env'

import { googleAuthorizeUrl } from '../api'
import { GOOGLE_ERROR_PARAM, googleErrorMessage } from '../lib/googleErrors'

import { GoogleLoginButton } from './GoogleLoginButton'

type Props = {
  label: string
  returnTo: string | null
}

/**
 * "또는" 구분선과 Google 버튼입니다. 누르면 Google 로그인 화면으로 넘어갔다가 돌아옵니다 — 이미
 * 가입한 사람은 `ROUTES.GOOGLE_LOGIN` 에서 로그인이 끝나고, 처음 온 사람은 `ROUTES.GOOGLE_SIGNUP`
 * 에서 닉네임을 정합니다.
 *
 * 실패하면 백엔드가 이 화면으로 `?googleError=코드` 를 붙여 돌려보내므로 그 문구도 여기서 보여 줍니다.
 */
export function GoogleLoginSection({ label, returnTo }: Props) {
  const { t } = useTranslation('auth')
  const [searchParams] = useSearchParams()
  const error = googleErrorMessage(searchParams.get(GOOGLE_ERROR_PARAM))

  if (!env.googleLoginEnabled) {
    return null
  }

  return (
    <div className="space-y-2.5">
      <div className="text-ink-muted text-caption flex items-center gap-2.5">
        <hr className="border-line flex-1" />
        <span>{t('google.or')}</span>
        <hr className="border-line flex-1" />
      </div>

      <GoogleLoginButton href={googleAuthorizeUrl(returnTo)}>
        {label}
      </GoogleLoginButton>

      {error !== null && (
        <p className="text-danger text-caption" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
