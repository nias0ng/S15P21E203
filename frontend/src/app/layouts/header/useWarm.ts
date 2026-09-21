import { useQueryClient } from '@tanstack/react-query'

import { ROUTES } from '@/shared/config/routes'

/**
 * 잠수로 가는 화면의 청크를 미리 받습니다 — 라우터의 `lazy()` 와 같은 모듈 캐시라
 * 미리 부르면 라우터가 기다릴 것이 없습니다.
 *
 * NOTE: 정적 import 를 쓰면 안 됩니다 — 헤더는 첫 번들에 들어 있어서 이 화면 여섯이
 * 메인 첫 진입에 통째로 딸려 옵니다.
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
 * 이 주소의 화면을 미리 받아 둡니다. 여러 번 불려도 됩니다 — 청크는 모듈 캐시가,
 * 목록은 `staleTime` 이 막습니다.
 */
export function useWarm() {
  const queryClient = useQueryClient()

  return (to: string) => {
    void PAGE_CHUNK[to]?.()
    if (to !== ROUTES.MY_SHELF) return
    /*
      NOTE: 진열대만 목록도 따로 미리 받습니다 — 병 수백 개로 벽을 세우는 곳이라
      청크만 와 있어도 화면이 스피너로 섭니다. 도메인은 여기서 `import()` 로 부릅니다
      (위에서 정적으로 import 하면 진열대가 메인 첫 진입에 딸려 옵니다).
    */
    void import('@/features/shelf').then(({ shelfItemsQuery }) =>
      queryClient.prefetchQuery(shelfItemsQuery()),
    )
  }
}
