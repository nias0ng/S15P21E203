import { Outlet } from 'react-router'

import { GlobalHeader } from '@/app/layouts/GlobalHeader'

/**
 * 모든 화면의 공통 껍데기.
 *
 * 콘텐츠 폭은 와이어프레임 S01 규격대로 1120px 고정입니다
 * (max-w-content = --container-content 토큰, styles/index.css).
 * 향 지도처럼 화면을 꽉 채워야 하는 화면은 페이지 안에서 폭 제한을 벗어납니다.
 */
export function RootLayout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <GlobalHeader />

      <main className="max-w-content mx-auto w-full flex-1 px-5 py-8">
        <Outlet />
      </main>
    </div>
  )
}
