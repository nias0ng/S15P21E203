import { AUTH_PAGE, GoogleSignupForm } from '@/features/auth'

import { useEnterAfterLogin } from './useEnterAfterLogin'

export default function GoogleSignupPage() {
  const enterAfterLogin = useEnterAfterLogin()

  return (
    <div className={AUTH_PAGE}>
      <GoogleSignupForm onSignedUp={enterAfterLogin} />
    </div>
  )
}
