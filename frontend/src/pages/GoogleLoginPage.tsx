import { AUTH_PAGE, GoogleLoginFinish } from '@/features/auth'

import { useEnterAfterLogin } from './useEnterAfterLogin'

export default function GoogleLoginPage() {
  const enterAfterLogin = useEnterAfterLogin()

  return (
    <div className={AUTH_PAGE}>
      <GoogleLoginFinish onLoggedIn={enterAfterLogin} />
    </div>
  )
}
