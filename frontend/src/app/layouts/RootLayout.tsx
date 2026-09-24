import { lazy, Suspense } from 'react'
import { Outlet, useMatches } from 'react-router'

import { GlobalHeader, type HeaderTone } from '@/app/layouts/GlobalHeader'
import { cn } from '@/shared/lib/cn'
import { useCausticsStore } from '@/shared/store/causticsStore'
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
 * 라우트의 `handle` 에 켜 둔 화면 장치. 어두운 방(`night`) · 물결(`caustics`) ·
 * 물결 대신 수면 아래(`underwater` — `caustics` 와 같이 켭니다) · 진열대 종이(`paper`).
 * 경로 배열과 `pathname` 을 맞추면 `/collections/:collectionId` 같은 동적 경로가 안 걸립니다.
 */
function useRouteFlag(
  flag: 'night' | 'caustics' | 'underwater' | 'paper',
): boolean {
  const matches = useMatches()
  for (let at = matches.length - 1; at >= 0; at -= 1) {
    const handle: unknown = matches[at]?.handle
    if (typeof handle === 'object' && handle !== null && flag in handle) {
      return (handle as Record<string, unknown>)[flag] === true
    }
  }
  return false
}

/*
 * three 가 무거워 물결이 있는 화면에 들어올 때 따로 받아 옵니다. 그동안은 방의 그라데이션만
 * 보이고, 물결은 첫 장이 그려진 뒤 서서히 드러납니다.
 */
const WaterCaustics = lazy(() =>
  import('@/shared/ui/WaterCaustics').then((module) => ({
    default: module.WaterCaustics,
  })),
)

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
  // 진열대와 그 안에서 들어가는 컬렉션 상세 — 같은 종이라 헤더도 같은 종이입니다
  const onPaper = useRouteFlag('paper')
  const onNight = useRouteFlag('night')
  const onCaustics = useRouteFlag('caustics')
  const onUnderwater = useRouteFlag('underwater')
  const causticsLayers = useCausticsStore((state) => state.layers)
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
        // 물결을 방의 바탕 바로 위 · 본문 아래에 끼우려고 여기서 겹을 새로 엽니다
        onCaustics && 'isolate',
      )}
    >
      {onCaustics && (
        <Suspense fallback={null}>
          {/*
            헤더는 방과 같은 그림을 불투명하게 나눠 그려 물결을 가립니다. 헤더 밑에서 물결이
            뚝 끊기면 가로 띠가 지므로, 헤더 아래에서부터 서서히 드러냅니다.
          */}
          <WaterCaustics
            layers={causticsLayers ?? 2}
            look={onUnderwater ? 'underwater' : 'caustics'}
            className="fixed inset-0 -z-10 [mask-image:linear-gradient(to_bottom,transparent_var(--header-h),#000_calc(var(--header-h)_+_var(--spacing)*40))]"
          />
        </Suspense>
      )}

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
