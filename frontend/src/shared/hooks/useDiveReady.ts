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
 * ⚠ **한 화면이 여러 번 알려도 됩니다.** 신호는 먼저 온 쪽이 이깁니다(store 의 `markReady`
 * 는 멱등입니다). 진열대가 그렇게 씁니다 — 벽은 "첫 화면 병이 다 섰다" 를 유예 없이 알리고,
 * 화면은 "목록은 칠해졌다" 를 `READY_GRACE_MS` 뒤에 알립니다. 실제로 걷히는 때는 둘 중
 * 이른 쪽이라, 사진이 빨리 오면 빨리 걷히고 안 와도 유예에서 끊깁니다.
 *
 * ```tsx
 * const shelf = useQuery(shelfItemsQuery())
 * useDiveReady(!shelf.isPending, READY_GRACE_MS)
 * ```
 */
export function useDiveReady(ready: boolean, graceMs = 0) {
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
    /*
      ⚠ 유예는 rAF 가 아니라 **시계**로 셉니다. 이 기다림은 '그려졌는가' 가 아니라 '더 나은
        신호를 기다려 준다' 라서, 메인 스레드가 막혀 늦게 와도 뜻이 안 변합니다 —
        늦어 봐야 더 기다린 것이고, 그 끝은 커튼의 상한(`READY_CAP_MS`)이 막습니다.
    */
    let timer = 0
    let raf = requestAnimationFrame(() => {
      raf = requestAnimationFrame(() => {
        if (graceMs <= 0) {
          markReady()
          return
        }
        timer = window.setTimeout(markReady, graceMs)
      })
    })
    return () => {
      cancelAnimationFrame(raf)
      window.clearTimeout(timer)
    }
  }, [ready, graceMs, markReady])
}
