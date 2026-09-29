import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router'

import { myTasteTestQuery } from '@/features/taste'
import { ROUTES } from '@/shared/config/routes'

/**
 * 로그인(또는 가입과 동시에 로그인)한 뒤 어디로 갈지 정합니다. 취향 테스트를 안 했으면
 * 테스트로, 했으면 원래 가려던 곳으로 보냅니다.
 *
 * NOTE: `features/auth` 가 `features/taste` 를 import 할 수 없어 화면 조립부(pages)에
 * 둡니다. 로그인 · 회원가입 · Google 가입 화면이 같이 씁니다.
 */
export function useEnterAfterLogin(): (from: string) => void {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  return (from) => {
    queryClient
      .fetchQuery(myTasteTestQuery())
      .then((record) =>
        navigate(record.completed ? from : ROUTES.TASTE_TEST, {
          replace: true,
        }),
      )
      .catch(() => navigate(from, { replace: true }))
  }
}
