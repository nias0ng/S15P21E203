import { Outlet, useLocation } from 'react-router'

import { GlobalHeader } from '@/app/layouts/GlobalHeader'
import { ROUTES } from '@/shared/config/routes'

/**
 * 모든 화면의 공통 껍데기.
 *
 * 콘텐츠 폭은 와이어프레임 S01 규격대로 1120px 고정입니다
 * (max-w-content = --container-content 토큰, styles/index.css).
 * 향 지도처럼 화면을 꽉 채워야 하는 화면은 페이지 안에서 폭 제한을 벗어납니다.
 */
export function RootLayout() {
  /*
   * 진열대는 화면 전체가 종이 한 장인 구성이라 헤더도 그 종이 위에 놓입니다.
   * 헤더가 자기 바탕(ivory)을 칠하면 종이가 두 장으로 잘려 가로줄이 생깁니다 —
   * 실제로 헤더 246 대 본문 219 로 눈에 띄게 갈라져 있었습니다.
   *
   * 라우트를 여기서 보는 이유: 헤더는 자기가 어느 화면 위에 있는지 모르고, 알게
   * 하면 화면이 늘 때마다 헤더를 고치게 됩니다. 껍데기가 화면을 아는 건 껍데기의
   * 일이라 여기 둡니다.
   */
  const onPaper = useLocation().pathname === ROUTES.MY_SHELF

  return (
    <div className="flex min-h-dvh flex-col">
      <GlobalHeader onPaper={onPaper} />

      <main className="max-w-content mx-auto w-full flex-1 px-5 py-8">
        <Outlet />
      </main>
    </div>
  )
}
