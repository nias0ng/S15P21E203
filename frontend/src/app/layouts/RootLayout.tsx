import { Outlet, useLocation, useMatches } from 'react-router'

import { GlobalHeader, type HeaderTone } from '@/app/layouts/GlobalHeader'
import { ROUTES } from '@/shared/config/routes'
import { cn } from '@/shared/lib/cn'
import { useSceneSkyStore } from '@/shared/store/sceneSkyStore'
import { DiveCurtain } from '@/shared/ui/DiveCurtain'

/**
 * 화면이 쓰는 본문 폭. 라우트의 `handle.width` 로 정합니다(적지 않으면 `wide`).
 *   full 틀 전체 · wide 1440 목록 · text 800 글 · bleed 헤더 뒤까지(3D 향 지도)
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
 * 어두운 방을 켜는 화면인지. 라우트의 `handle.night` 로 정합니다 — 경로 배열을 두고
 * `pathname` 과 맞춰보던 때, `/notes/:noteId` 는 실제 주소가 `/notes/5` 라 **영영
 * 안 걸렸습니다.** docs/어두운-방-유리판.md
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
 * 모든 화면의 공통 껍데기. 넓게 쓰는 화면은 음수 마진으로 틀을 깨고 나가지 말고
 * 라우트에 `full` 이라고 적습니다.
 */
export function RootLayout() {
  /*
   * 진열대는 화면 전체가 종이 한 장이라 헤더가 자기 바탕을 칠하면 종이가 두 장으로
   * 잘립니다(헤더 246 대 본문 219 로 갈라져 있었습니다). 라우트를 헤더가 아니라
   * 여기서 보는 이유: 헤더가 화면을 알면 화면이 늘 때마다 헤더를 고치게 됩니다.
   */
  const pathname = useLocation().pathname
  const onPaper = pathname === ROUTES.MY_SHELF
  /*
   * 어두운 방 — 어느 화면이 여기 드는지와 까닭은 docs/어두운-방-유리판.md.
   * 어둠이 헤더까지 덮어야 한 장으로 읽혀서 진열대 종이와 같은 자리에서 정합니다.
   */
  const onNight = useIsNight()
  const width = usePageWidth()
  const sky = useSceneSkyStore((state) => state.sky)
  /*
   * bleed(3D 향 지도)는 헤더가 유리판으로 뜹니다. `fixed` 라 본문이 화면 맨 위부터
   * 서고, 헤더가 가리는 높이는 HomePage 가 엔진에 알려 줍니다. 글자색은 뒤의
   * 하늘을 따릅니다(sceneSkyStore).
   */
  const tone: HeaderTone = onPaper
    ? 'paper'
    : width === 'bleed'
      ? sky === 'light'
        ? 'glassLight'
        : 'glass'
      : 'surface'

  return (
    /*
      overflow-x-clip : 헤더가 화면 폭(100vw)이라 스크롤바 밑으로 나간 15px 을 자릅니다.
      ⚠ hidden 이 아니라 clip — hidden 은 스크롤 상자를 만들어 sticky 가 풀립니다.
      ⚠ 헤더와 같은 `sm`(640) 부터 — 더 좁으면 돋보기 · 계정을 못 누릅니다.
    */
    <div
      className={cn(
        'flex min-h-dvh flex-col sm:overflow-x-clip',
        onNight && 'scent-night',
      )}
    >
      <GlobalHeader tone={tone} />

      {/* 위 숨은 모든 화면이 같은 값입니다 — 다르면 화면을 옮길 때 제목이 튑니다 */}
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

      {/*
        잠수 커튼 — 메인(3D 향 지도)에서 진열대로 넘어가는 전환 (2026-09-18).
        ⚠⚠ **여기(껍데기)에 있어야 합니다.** 화면 안에 두면 경로가 바뀌는 순간 커튼도 같이
          언마운트되어, 덮고 있어야 할 자리에 아이보리 바탕이 그대로 드러납니다.
          평소에는 아무것도 그리지 않습니다 (DiveCurtain 이 idle 이면 null).
      */}
      <DiveCurtain />
    </div>
  )
}
