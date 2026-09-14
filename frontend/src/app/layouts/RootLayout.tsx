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
   * 진열대는 화면 전체가 종이 한 장이라 헤더가 자기 바탕을 칠하면 가로줄이 생깁니다.
   * 라우트를 여기서 보는 이유: 헤더가 화면을 알게 하면 화면이 늘 때마다 헤더를
   * 고치게 됩니다.
   */
  const onPaper = useLocation().pathname === ROUTES.MY_SHELF

  return (
    <div className="flex min-h-dvh flex-col">
      <GlobalHeader onPaper={onPaper} />

      {/* 위 56px 은 헤더 아래 숨. 진열대 화면과 같은 값이라 넘어갈 때 제목이 안 튑니다 */}
      <main className="max-w-content mx-auto w-full flex-1 px-5 pt-14 pb-16">
        <Outlet />
      </main>
    </div>
  )
}
