import { useEffect } from 'react'

import { useDiveStore } from '@/shared/store/diveStore'

/**
 * 잠수 커튼에게 "이 화면은 이제 그릴 준비가 됐다" 고 알립니다 (2026-09-18).
 *
 * 메인에서 진열대로 넘어갈 때 커튼은 짙은 남색으로 덮은 채 **이 신호**나 상한(1.5초) 중
 * 먼저 오는 쪽에 걷힙니다. 안 알려도 상한에 걷히지만, 그때까지 남색 화면이 그대로 섭니다.
 *
 * ⚠ 잠수로 들어온 것이 아니면(주소로 바로 들어오기 · 다른 화면에서 이동) 커튼이 없어 아무 일도
 * 안 일어납니다 — 화면 쪽에서 가릴 필요가 없습니다.
 *
 * ⚠ 이 훅이 `features/` 가 아니라 `shared/` 에 있는 까닭은 잠수가 **한 도메인의 것이 아니기**
 * 때문입니다 (`shared/store/diveStore` 머리말).
 *
 * ```tsx
 * const shelf = useQuery(shelfItemsQuery())
 * useDiveReady(!shelf.isPending)
 * ```
 */
export function useDiveReady(ready: boolean) {
  const markReady = useDiveStore((state) => state.markReady)

  useEffect(() => {
    if (!ready) return
    /*
      ⚠⚠ **데이터가 왔다 ≠ 화면이 그려졌다.** 곧바로 알리면 커튼이 걷히기 시작하는 동안 화면이
      아직 그 무거운 첫 장을 그리고 있습니다 — 진열대는 벽감 수십 개와 병 사진을 한 번에 세우는
      화면이라 그 한 장이 눈에 띄게 걸립니다 (2026-09-18 사용자 : *"진열대 페이지 자체에도
      무거움이 존재해서"*).

      rAF 를 **두 번** 겹쳐 그 첫 장이 실제로 칠해진 뒤에 알립니다 (한 번은 칠하기 **전**입니다).
      ⚠ 사진까지 기다리지는 않습니다 — 사진은 받은 것부터 차례로 드러나므로(`useBottlePreload`)
        거기까지 기다리면 커튼이 늘 상한(`READY_CAP_MS`)까지 서 있습니다.
    */
    let raf = requestAnimationFrame(() => {
      raf = requestAnimationFrame(markReady)
    })
    return () => cancelAnimationFrame(raf)
  }, [ready, markReady])
}
