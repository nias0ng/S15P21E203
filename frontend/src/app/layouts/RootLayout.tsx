import { Outlet, useLocation, useMatches } from 'react-router'

import { GlobalHeader, type HeaderTone } from '@/app/layouts/GlobalHeader'
import { ROUTES } from '@/shared/config/routes'
import { cn } from '@/shared/lib/cn'
import { useSceneSkyStore } from '@/shared/store/sceneSkyStore'
import { DiveCurtain } from '@/shared/ui/DiveCurtain'

/**
 * 화면이 쓰는 본문 폭. 라우트의 `handle.width` 로 정합니다(적지 않으면 `wide`).
 * full 틀 전체 · wide 1440 목록 · text 800 글 · bleed 헤더 뒤까지(3D 향 지도)
 */
export type PageWidth = 'full' | 'wide' | 'text' | 'bleed'

const WIDTH: Record<PageWidth, string> = {
  full: '',
  wide: 'max-w-wide',
  text: 'max-w-text',
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
 * 어두운 방을 켜는 화면인지. 라우트의 `handle.night` 로 정합니다 — 경로 배열과
 * `pathname` 을 맞추면 `/notes/:noteId` 같은 동적 경로가 안 걸립니다.
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
   * 진열대 종이 · 어두운 방은 헤더까지 덮어야 한 장으로 읽혀서 헤더가 아니라 여기서
   * 정합니다 — 헤더가 화면을 알면 화면이 늘 때마다 헤더를 고치게 됩니다.
   * 어느 화면이 어두운 방인지는 docs/어두운-방-유리판.md.
   */
  const pathname = useLocation().pathname
  const onPaper = pathname === ROUTES.MY_SHELF
  const onNight = useIsNight()
  const width = usePageWidth()
  const sky = useSceneSkyStore((state) => state.sky)
  // bleed(3D 향 지도)의 유리판 헤더는 글자색이 뒤의 하늘을 따릅니다
  const tone: HeaderTone = onPaper
    ? 'paper'
    : width === 'bleed'
      ? sky === 'light'
        ? 'glassLight'
        : 'glass'
      : onNight
        ? 'night'
        : 'surface'

  return (
    /*
      NOTE: 헤더가 화면 폭(100vw)이라 나간 15px 을 여기서 자릅니다. hidden 이 아니라
      clip 인 이유 — hidden 은 스크롤 상자를 만들어 sticky 가 풀립니다.
    */
    <div
      className={cn(
        'flex min-h-dvh flex-col sm:overflow-x-clip',
        onNight && 'scent-night',
      )}
    >
      <GlobalHeader tone={tone} />

      <main
        className={cn(
          'mx-auto w-full flex-1',
          // bleed 는 화면을 그림으로 채우므로 틀 · 여백을 두지 않습니다
          width !== 'bleed' && 'max-w-frame px-[var(--gutter)] pt-15 pb-15',
        )}
      >
        <div className={cn('mx-auto w-full', WIDTH[width])}>
          <Outlet />
        </div>
      </main>

      {/*
        NOTE: 잠수 커튼은 껍데기에 있어야 합니다 — 화면 안에 두면 경로가 바뀌는 순간
        커튼도 함께 언마운트되어, 덮고 있어야 할 자리가 그대로 드러납니다.
      */}
      <DiveCurtain />
    </div>
  )
}
