import { useNavigate } from 'react-router'

import { TasteTestStep } from '@/features/taste'
import { ROUTES } from '@/shared/config/routes'

/**
 * 취향 테스트 (요구사항 TST-03)
 *
 * **첫 로그인 직후 한 번 거치는 화면입니다.** 로그인 화면이 `GET /users/me/taste-test`
 * 로 아직 치르지 않은 사람을 가려 여기로 보냅니다(`LoginPage`). 가입 응답에 토큰이 없어
 * 가입 화면에서 바로 띄울 수 없고, 서버도 "가입 뒤 첫 로그인" 을 기준으로 봅니다.
 *
 * 독립 라우트로 남겨 둡니다. 주소로 직접 들어와도 열리는데, 이미 마친 사람은 저장이
 * 409 로 돌아오고 `TasteTestStep` 이 그것을 "이미 됨" 으로 받아 넘깁니다.
 *
 * 결과 모달에서 확인을 누르면 결과를 저장하고 향 지도로 이동합니다. 뽑힌 향수 자리에
 * 배를 띄우는 것은 지도 쪽 작업입니다.
 */
export default function TasteTestPage() {
  const navigate = useNavigate()

  return (
    <div className="py-6">
      <TasteTestStep onComplete={() => navigate(ROUTES.HOME)} />
    </div>
  )
}
