import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router'

import { AUTH_PAGE, LoginForm } from '@/features/auth'
import { myTasteTestQuery } from '@/features/taste'
import { ROUTES } from '@/shared/config/routes'

export default function LoginPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  return (
    <div className={AUTH_PAGE}>
      <LoginForm
        onLoggedIn={(from) => {
          queryClient
            .fetchQuery(myTasteTestQuery())
            .then((record) =>
              navigate(record.completed ? from : ROUTES.TASTE_TEST, {
                replace: true,
              }),
            )
            .catch(() => navigate(from, { replace: true }))
        }}
      />
    </div>
  )
}
