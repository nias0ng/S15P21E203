import { useQueryClient } from '@tanstack/react-query'

import { ROUTES } from '@/shared/config/routes'

/**
 * 잠수로 가는 화면의 **청크**를 미리 받습니다 — 라우터의 `lazy()` 와 **같은 모듈 캐시**라
 * 미리 부르면 라우터가 기다릴 것이 없습니다 (`app/router/index.tsx` 의 그 import 와 같은 경로).
 *
 * ⚠ 잠수는 1초 남짓에 끝나는데 도착 화면은 청크와 목록 API 왕복이 남아 있습니다. 미리 안 받으면
 *   커튼이 덮은 뒤 그 둘을 기다리느라 덮인 화면이 상한(`READY_CAP_MS`)까지 서 있습니다.
 *   마우스를 올린 순간이면 대개 누르기 전에 청크가 끝납니다.
 * ⚠ **정적 import 를 쓰면 안 됩니다.** 헤더는 첫 번들(main)에 들어 있어서, 정적으로 쓰면 이
 *   화면 여섯의 컴포넌트 · 쿼리 · 전용 스타일시트가 **메인 첫 진입에 통째로 딸려 옵니다**
 *   (아래 진열대 주석의 실측이 그 이야기입니다).
 */
const PAGE_CHUNK: Readonly<Record<string, () => Promise<unknown>>> = {
  [ROUTES.PERFUMES]: () => import('@/pages/PerfumeListPage'),
  [ROUTES.BRANDS]: () => import('@/pages/BrandListPage'),
  [ROUTES.NOTES]: () => import('@/pages/NoteListPage'),
  [ROUTES.COMMUNITY_REVIEWS]: () => import('@/pages/ReviewBoardPage'),
  [ROUTES.COMMUNITY_FREE]: () => import('@/pages/FreeBoardPage'),
  [ROUTES.MY_SHELF]: () => import('@/pages/MyShelfPage'),
}

/**
 * 이 주소의 화면을 미리 받아 둡니다 — 마우스를 올리거나 탭으로 옮겨 온 순간입니다.
 * 잠수를 걸 때 한 번 더 부릅니다 (마우스를 안 거치고 탭 · 엔터로 누르는 길이 있습니다).
 *
 * ⚠ 여러 번 불려도 됩니다 — 청크는 모듈 캐시가, 목록은 `staleTime` 이 막습니다.
 */
export function useWarm() {
  const queryClient = useQueryClient()

  return (to: string) => {
    void PAGE_CHUNK[to]?.()
    if (to !== ROUTES.MY_SHELF) return
    /*
      ⚠⚠ **진열대 목록은 청크와 따로 미리 받습니다.** 이 화면만 목록 하나에 병 수백 개를 받아
        벽을 세우는 곳이라, 청크만 와 있어도 화면이 스피너로 섭니다.
      ⚠⚠ **도메인은 `import()` 로 부릅니다 — 위에서 정적으로 import 하면 안 됩니다.**
        실측 (2026-09-18 빌드) : 정적 import 면 main **305.7KB** · main.css **93.9KB** 이고 진열대
        청크가 아예 없습니다. `import()` 면 main **266.2KB** · main.css **70.8KB** 이고 진열대가
        제 청크로 떨어집니다 (shelf 51.2KB + shelf.css 23.1KB — 메인 첫 진입은 그것을 안 받습니다).
      ⚠ 나머지 다섯은 청크만 받습니다 — 목록이 진열대만큼 무겁지 않아 최소 잔류(`HOLD_MIN_MS`
        0.42초) 안에 대개 들어옵니다. 어느 화면이 눈에 띄게 늦으면 그 화면만 여기에 더합니다.
    */
    void import('@/features/shelf').then(({ shelfItemsQuery }) =>
      queryClient.prefetchQuery(shelfItemsQuery()),
    )
  }
}
