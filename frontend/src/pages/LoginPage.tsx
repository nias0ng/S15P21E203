import { AUTH_PAGE, LoginForm } from '@/features/auth'

import { useEnterAfterLogin } from './useEnterAfterLogin'

export default function LoginPage() {
  const enterAfterLogin = useEnterAfterLogin()

  return (
    <div className={AUTH_PAGE}>
      <LoginForm onLoggedIn={enterAfterLogin} />
    </div>
  )
}
