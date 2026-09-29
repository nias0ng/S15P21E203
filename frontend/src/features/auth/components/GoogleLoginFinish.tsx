import { useMutation } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router'

import { apiErrorMessage } from '@/shared/api/http'
import { ROUTES } from '@/shared/config/routes'
import { RETURN_PATH_PARAM, safeReturnPath } from '@/shared/lib/returnPath'
import { useAuthStore } from '@/shared/store/authStore'

import { getMe, refreshSession, toAuthUser } from '../api'

import { AuthCard } from './AuthCard'
import { BackToLogin } from './BackToLogin'

type Props = {
  onLoggedIn: (from: string) => void
}

/**
 * Google 에서 돌아와 로그인을 마무리합니다. 백엔드 콜백이 Refresh Token 쿠키만 심고 이리로 보내므로,
 * 그 쿠키로 Access Token 을 받고 내 정보를 채웁니다.
 */
export function GoogleLoginFinish({ onLoggedIn }: Props) {
  const [searchParams] = useSearchParams()
  const returnTo = safeReturnPath(searchParams.get(RETURN_PATH_PARAM))
  const setAuth = useAuthStore((state) => state.setAuth)

  const { mutate, error } = useMutation({
    mutationFn: async () => {
      const accessToken = await refreshSession()
      useAuthStore.getState().setAccessToken(accessToken)
      return { accessToken, user: toAuthUser(await getMe()) }
    },
    onSuccess: ({ accessToken, user }) => {
      setAuth({ accessToken, user })
      onLoggedIn(returnTo ?? ROUTES.HOME)
    },
    onError: () => useAuthStore.getState().clear(),
  })

  // NOTE: 한 번만 부릅니다. 재발급은 Refresh Token 을 바꿔 끼우므로, 개발 모드의 StrictMode 가
  // 효과를 두 번 돌려 두 번 부르면 둘째 요청이 이미 바뀐 토큰을 들고 가 실패합니다.
  const started = useRef(false)
  useEffect(() => {
    if (started.current) {
      return
    }
    started.current = true
    mutate()
  }, [mutate])

  if (error !== null) {
    return (
      <AuthCard
        title="Google 로그인"
        description={apiErrorMessage(
          error,
          'Google 로그인을 마치지 못했습니다. 처음부터 다시 해주세요.',
        )}
      >
        <BackToLogin returnTo={returnTo} />
      </AuthCard>
    )
  }

  return <AuthCard title="Google 로그인" description="로그인하고 있습니다." />
}
