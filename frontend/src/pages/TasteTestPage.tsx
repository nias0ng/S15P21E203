import { useNavigate } from 'react-router'

import { TasteTestStep } from '@/features/taste'
import { ROUTES } from '@/shared/config/routes'

/**
 * 취향 테스트 (TST-03). 첫 로그인 직후 한 번 거치는 화면이고 `LoginPage` 가 보냅니다
 * — 가입 응답에 토큰이 없어 가입 화면에서는 못 띄웁니다. 주소로 직접 들어와도 열리고,
 * 이미 마친 사람은 저장이 409 로 돌아와 `TasteTestStep` 이 받아 넘깁니다.
 */
export default function TasteTestPage() {
  const navigate = useNavigate()

  return (
    <div className="py-6">
      <TasteTestStep onComplete={() => navigate(ROUTES.HOME)} />
    </div>
  )
}
