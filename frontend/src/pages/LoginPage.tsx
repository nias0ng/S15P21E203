import { useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router'

import { LoginForm } from '@/features/auth'
import { myTasteTestQuery } from '@/features/taste'
import { ROUTES } from '@/shared/config/routes'
import { RETURN_PATH_PARAM, safeReturnPath } from '@/shared/lib/returnPath'

/**
 * 로그인 (A28 — COM-02). **첫 로그인이면 취향 테스트(TST-03)로 보냅니다** —
 * `GET /users/me/taste-test` 가 `completed: false` 인 200 으로 답합니다. 이 판단이
 * `LoginForm` 이 아니라 여기 있는 것은 `features/auth` 가 `features/taste` 를
 * import 할 수 없어서입니다.
 */
export default function LoginPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const queryClient = useQueryClient()

  /*
    **주소(`?redirectTo=`)에 실어 나르는 이유:** 라우터 state 는 새로고침하면
    사라져, 비밀번호를 찾다 돌아오면 돌아갈 곳을 잃습니다.
  */
  const from =
    safeReturnPath(searchParams.get(RETURN_PATH_PARAM)) ?? ROUTES.HOME

  return (
    <div className="flex justify-center py-6.25">
      <LoginForm
        onLoggedIn={() => {
          /*
            `fetchQuery` 라 캐시에 있으면 요청이 안 나갑니다. 실패하면 원래 가려던
            곳으로 보냅니다 — 기록을 못 읽은 것이지 로그인이 안 된 것은 아닌데,
            여기서 막으면 로그인 화면에 갇힙니다.
          */
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
