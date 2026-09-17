import { Outlet, useLocation, useMatches } from 'react-router'

import { GlobalHeader } from '@/app/layouts/GlobalHeader'
import { ROUTES } from '@/shared/config/routes'
import { cn } from '@/shared/lib/cn'

/**
 * 화면이 쓰는 본문 폭. 라우트 설정(app/router)의 `handle.width` 로 정합니다.
 *
 *   full  화면 틀 전체(1920 에서 1800) — 진열대 · 향 지도처럼 화면을 그림으로 쓰는 곳
 *   wide  1440 — 목록 · 격자 · 상세 (적지 않으면 이것)
 *   text  800 — 글을 읽고 쓰는 곳 · 계정 폼
 *   bleed 헤더 아래 화면 끝까지 — 틀 · 좌우 여백 · 위아래 숨 없이 (3D 향 지도 A01)
 *
 * 폭의 근거는 styles/index.css 의 --container-* 주석에 있습니다.
 */
export type PageWidth = 'full' | 'wide' | 'text' | 'bleed'

const WIDTH: Record<PageWidth, string> = {
  full: '',
  wide: 'max-w-wide',
  text: 'max-w-text',
  // 틀 · 여백 · 숨은 아래 main 에서 걷습니다
  bleed: '',
}

const isPageWidth = (value: unknown): value is PageWidth =>
  value === 'full' || value === 'wide' || value === 'text' || value === 'bleed'

/** 지금 화면의 폭. 가장 안쪽 라우트에 적힌 값이 이깁니다 */
function usePageWidth(): PageWidth {
  const matches = useMatches()
  for (let at = matches.length - 1; at >= 0; at -= 1) {
    const handle: unknown = matches[at]?.handle
    if (
      typeof handle === 'object' &&
      handle !== null &&
      'width' in handle &&
      isPageWidth(handle.width)
    ) {
      return handle.width
    }
  }
  return 'wide'
}

/**
 * 어두운 방(`styles/scent-display.css` 의 `.scent-night`)을 켜는 화면인지.
 * 라우트 설정(app/router)의 `handle.night` 로 정합니다 — 폭과 같은 자리입니다.
 *
 * 예전에는 여기에 경로 배열을 두고 `pathname` 과 문자열로 맞춰봤습니다. 상세
 * 화면이 어두워지면서 그 방식이 깨졌습니다 — `/notes/:noteId` 는 라우트에 적힌
 * 모양이고 실제 주소는 `/notes/5` 라, 배열에 넣어도 **영영 안 걸립니다.**
 * 라우트 옆에 적으면 파라미터가 있든 없든 그냥 됩니다.
 */
function useIsNight(): boolean {
  const matches = useMatches()
  for (let at = matches.length - 1; at >= 0; at -= 1) {
    const handle: unknown = matches[at]?.handle
    if (typeof handle === 'object' && handle !== null && 'night' in handle) {
      return handle.night === true
    }
  }
  return false
}

/**
 * 모든 화면의 공통 껍데기.
 *
 * 1920 x 1080 이 가장 넓은 규격입니다. 틀(max-w-frame, 1920)에 좌우 여백(--gutter,
 * 1920 에서 60)을 두르고, 그 안에서 화면마다 정한 폭(full · wide · text)으로 본문을
 * 가운데 세웁니다. 헤더도 같은 틀과 여백을 써서 로고와 본문 왼쪽 끝이 한 줄에 섭니다.
 *
 * 예전에는 모든 화면이 1120 고정(와이어프레임 S01)이었고, 넓게 써야 하는 진열대만
 * 음수 마진으로 그 제약을 깨고 나갔습니다. 이제 넓게 쓰는 화면은 라우트에 full 이라고
 * 적기만 하면 됩니다.
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
  const pathname = useLocation().pathname
  const onPaper = pathname === ROUTES.MY_SHELF
  /*
   * 향수 목록 · 그 검색 결과 · 브랜드 · 노트는 어두운 방에 유리판이 떠 있는
   * 구성입니다(A33 · A09 · A34 · A35 · A36 시안). 어둠이 헤더까지 덮어야 한 장으로
   * 읽혀서 진열대 종이와 같은 자리에서 정합니다.
   *
   * 이들을 같이 묶는 이유: 서로 **한 번에 넘어가는 사이**입니다. 향수 목록의
   * 검색창에 글을 치면 검색 결과로 가고, 브랜드와 노트는 상단 메뉴에서 향수
   * 바로 옆입니다. 한쪽만 어두우면 누른 순간 화면 전체가 뒤집힙니다.
   *
   * `.scent-night` 는 색 토큰(ink · line · surface-card)을 어둠 기준으로 다시
   * 정의하기만 합니다 — 헤더도 그 토큰을 쓰고 있어 컴포넌트를 고치지 않습니다.
   * 자세한 설명은 styles/scent-display.css 에 있습니다.
   */
  const onNight = useIsNight()
  const width = usePageWidth()

  return (
    <div className={cn('flex min-h-dvh flex-col', onNight && 'scent-night')}>
      <GlobalHeader onPaper={onPaper} />

      {/*
        위 60px 은 헤더(90px) 아래 숨입니다. 진열대 화면도 같은 값을 씁니다 —
        화면마다 다르면 게시판에서 진열대로 넘어갈 때 제목 높이가 튑니다.
      */}
      <main
        className={cn(
          'mx-auto w-full flex-1',
          // bleed(3D 향 지도)는 화면을 그림으로 채우므로 틀 · 좌우 여백 · 위아래 숨을 두지 않습니다
          width !== 'bleed' && 'max-w-frame px-[var(--gutter)] pt-15 pb-15',
        )}
      >
        <div className={cn('mx-auto w-full', WIDTH[width])}>
          <Outlet />
        </div>
      </main>
    </div>
  )
}
