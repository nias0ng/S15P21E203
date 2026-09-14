import { useNavigate } from 'react-router'

import { TasteTestStep } from '@/features/taste'
import { ROUTES } from '@/shared/config/routes'

/**
 * 취향 테스트 (요구사항 TST-03)
 *
 * 원래 자리는 회원가입 직후의 온보딩 스텝입니다. 다만 백엔드가 붙기 전이라 가입을
 * 끝까지 진행할 수 없어, 화면을 바로 열어볼 수 있도록 독립 경로를 두었습니다.
 * 가입이 동작하면 이 라우트를 지우고 `SignupPage` 의 다음 스텝으로 옮기면 됩니다.
 *
 * 결과 모달에서 확인을 누르면 향 지도로 이동합니다. 뽑힌 향수를 지도에 표시하는
 * 것은 향 지도 API 가 붙은 뒤의 작업입니다.
 */
export default function TasteTestPage() {
  const navigate = useNavigate()

  return (
    <div className="py-6">
      <TasteTestStep onComplete={() => navigate(ROUTES.HOME)} />
    </div>
  )
}
