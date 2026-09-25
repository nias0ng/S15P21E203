import { useSearchParams } from 'react-router'

import { AUTH_PAGE, PasswordFindForm, PasswordResetForm } from '@/features/auth'

export default function PasswordResetPage() {
  const [searchParams] = useSearchParams()
  const hasToken = Boolean(searchParams.get('token'))

  return (
    <div className={AUTH_PAGE}>
      {hasToken ? <PasswordResetForm /> : <PasswordFindForm />}
    </div>
  )
}
