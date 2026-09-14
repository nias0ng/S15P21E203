import { useEffect, useLayoutEffect, useState, type RefObject } from 'react'

import type { WallSection } from '../lib'

/**
 * 한꺼번에 풀기(decode)를 맡기는 사진 수. 스물다섯 장을 한꺼번에 맡기면 첫 화면 사진이 줄 뒤로
 * 밀리고, 한 장씩이면 풀기가 늦는 큰 사진 하나에 줄이 밀립니다. 자리는 다 받은 사진만 쥡니다(pump).
 */
const CONCURRENCY = 2

/** 브라우저가 한가해지기를 이만큼(ms)까지만 기다립니다. 바쁜 화면에서 병이 오래 비어 있지 않게 */
const IDLE_TIMEOUT_MS = 300

type Queued = {
  img: HTMLImageElement
  /** 벽 첫 칸부터 센 칸 순서 */
  slot: number
  /** 첫 화면 사진(DisplayCase 가 fetchpriority="high" 를 건 사진) */
  first: boolean
}

/**
 * 벽의 병 사진을 창 가운데에서 가까운 것부터 차례로 풀어 두고, 풀린 병을 **한 번만** 드러냅니다.
 *
 * 사진은 전부 처음부터 DOM 에 있고(loading="eager") 요청도 처음에 한꺼번에 나갑니다. 첫 화면 병만
 * fetchpriority="high" 로 앞세우고 나머지는 "low" 로 뒤에 받습니다(DisplayCase). 이 훅은 그다음을 맡습니다.
 *
 *   1. 그린 직후(레이아웃 효과) 이미 받아 둔 사진(complete)은 곧바로 data-ready 를 겁니다 — 배치가
 *      바뀌어 벽을 새로 그려도 받아 둔 병이 사라졌다 나타나지 않습니다.
 *   2. 브라우저가 한가해지면(requestIdleCallback) 나머지를 줄 세웁니다. 첫 화면 사진이 맨 앞이고, 그 뒤는
 *      가리지 않는 자리의 가운데에서 가까운 순서 — 오른쪽 · 왼쪽을 번갈아 — 입니다.
 *   3. 다 받은 사진을 두 장씩 img.decode() 로 풀어, 풀리면 그 병 상자에 data-ready 를 겁니다. 떼어 낸
 *      복사본이 아니라 **화면의 그 img** 를 풀어서, 그릴 때 그 풀린 사진을 그대로 씁니다. 아직 받는 중인
 *      사진은 줄에서 건너뛰었다가 받기가 끝나면(load · error) 곧바로 풉니다 — 받기가 느린 사진 하나가
 *      먼저 받은 병까지 붙잡아 투명하게 두지 않습니다.
 *   4. 벽이 다른 칸에 서면 남은 줄을 새 가운데 기준으로 다시 세웁니다.
 *
 * data-ready 는 React 가 그리지 않고 DOM 에 직접 씁니다. 다시 그려도 지워지지 않고, 지우는 길도
 * 없습니다 — 병은 한 번 드러나면(200ms) 다시는 투명해졌다 나타나지 않습니다(shelf-display.css 의 --ready).
 * 받다 실패한 사진도 풀기가 끝나면 data-ready 를 겁니다. 안 걸면 그 칸은 접지 그림자까지 영영 비어 있습니다.
 *
 * 예전에는 사진이 받아지는 대로 한 장씩 툭툭 나타났고, 창 밖 사진은 벽이 흘러 처음 드러날 때 풀리느라
 * 그 프레임이 늘어졌습니다.
 */
export function useBottlePreload(
  track: RefObject<HTMLElement | null>,
  sections: readonly WallSection[],
  start: number,
  clear: number,
  /** 벽을 그렸는가(크기를 잰 뒤). 그 전에는 트랙이 없습니다 */
  enabled: boolean,
) {
  const [preloader] = useState(createPreloader)

  // 벽을 처음 그리거나 병이 바뀌면(검색 · 분류 변경) 새로 들어온 사진을 줄에 넣습니다
  useLayoutEffect(() => {
    const root = track.current
    if (!enabled || !root) return
    return preloader.scan(root, sections)
  }, [preloader, track, enabled, sections])

  // 벽이 선 칸이 바뀌면 남은 줄을 그 칸의 가리지 않는 자리 가운데 기준으로 다시 세웁니다
  useEffect(() => {
    preloader.aim(start + clear / 2)
  }, [preloader, start, clear])
}

/** 브라우저가 한가할 때 한 번 부릅니다. 돌려주는 함수로 취소합니다 */
function whenIdle(callback: () => void) {
  if (typeof window.requestIdleCallback === 'function') {
    const handle = window.requestIdleCallback(callback, {
      timeout: IDLE_TIMEOUT_MS,
    })
    return () => window.cancelIdleCallback(handle)
  }
  // 사파리처럼 requestIdleCallback 이 없으면 지금 하던 일(그리기)이 끝난 뒤로 미룹니다
  const handle = window.setTimeout(callback, 0)
  return () => window.clearTimeout(handle)
}

function createPreloader() {
  /** 풀기를 기다리는 줄 — 앞에서부터 꺼냅니다 */
  let waiting: Queued[] = []
  /** 풀기를 기다리는 중인 사진 */
  const busy = new Set<HTMLImageElement>()
  /** 풀기가 끝난 사진 */
  const done = new WeakSet<HTMLImageElement>()
  /** 줄을 세우는 기준 — 가리지 않는 자리의 가운데(칸, 소수) */
  let center = 0

  /*
   * 줄 순위(작을수록 앞). 칸 가운데와 기준 사이 거리의 두 배에, 왼쪽이면 1 을 더합니다 — 거리가
   * 칸 단위로 한 칸씩 벌어지므로 가운데 · 오른쪽 · 왼쪽 · 오른쪽 · 왼쪽 … 으로 번갈아 섭니다.
   */
  const rank = ({ slot, first }: Queued) => {
    const offset = slot + 0.5 - center
    return (first ? -1e6 : 0) + Math.abs(offset) * 2 + (offset > 0 ? 0 : 1)
  }
  const sort = () => {
    waiting.sort((a, b) => rank(a) - rank(b))
  }

  const reveal = (img: HTMLImageElement) => {
    const box = img.closest('[data-photo]')
    if (box && !box.hasAttribute('data-ready'))
      box.setAttribute('data-ready', '')
  }

  const pump = () => {
    let at = 0
    while (busy.size < CONCURRENCY && at < waiting.length) {
      const next = waiting[at]
      // 기다리는 사이 벽에서 빠진 병(검색)은 줄에서 뺍니다
      if (!next || !next.img.isConnected) {
        waiting.splice(at, 1)
        continue
      }
      /*
       * 아직 받는 중인 사진은 건너뛰고 자리를 비워 둡니다. decode() 는 받기가 끝날 때까지 기다려서,
       * 받기가 느린 사진이 자리를 쥐고 있으면 이미 받아 둔 병까지 그 뒤에 묶여 투명한 채 남습니다.
       * 받기가 끝나면 scan 이 사진에 걸어 둔 load · error 가 줄을 다시 돌립니다.
       */
      if (!next.img.complete) {
        at += 1
        continue
      }
      waiting.splice(at, 1)
      const { img } = next
      busy.add(img)
      // 받기 · 풀기에 실패해도 줄은 이어 갑니다
      const decoded =
        typeof img.decode === 'function' ? img.decode() : Promise.resolve()
      void decoded
        .catch(() => {})
        .then(() => {
          busy.delete(img)
          done.add(img)
          reveal(img)
          pump()
        })
    }
  }

  return {
    /**
     * 트랙 안의 병 사진을 모아 줄에 넣습니다. 이미 받아 둔 사진은 곧바로 드러내고, 줄 세우기와
     * 풀기는 브라우저가 한가할 때 시작합니다. 돌려주는 함수는 아직 시작하지 않은 줄을 거둡니다.
     */
    scan(root: HTMLElement, sections: readonly WallSection[]) {
      // 벽 순서 그대로의 칸 순서. 병 칸(.shelf-slot)이 DOM 에 이 순서로 섭니다(ShelfWall · DisplayCase)
      const slots = sections.flatMap((section) =>
        section.items.map((_, at) => section.start + at),
      )
      const found: Queued[] = []
      /** 받는 중인 사진에 건 load · error. 줄을 거둘 때 함께 뗍니다 */
      const listening = new AbortController()
      root
        .querySelectorAll<HTMLElement>('.shelf-slot')
        .forEach((button, at) => {
          const img =
            button.querySelector<HTMLImageElement>('.shelf-bottle-img')
          if (!img || done.has(img) || busy.has(img)) return
          if (img.complete && img.naturalWidth > 0) reveal(img)
          if (!img.complete) {
            // 줄에서 건너뛰던(pump) 사진입니다. 받기가 끝나면 줄을 다시 돌려 곧바로 풉니다
            const { signal } = listening
            img.addEventListener('load', pump, { signal })
            img.addEventListener('error', pump, { signal })
          }
          found.push({
            img,
            slot: slots[at] ?? at,
            first: img.getAttribute('fetchpriority') === 'high',
          })
        })

      const cancel = whenIdle(() => {
        waiting = found
        sort()
        pump()
      })
      return () => {
        cancel()
        listening.abort()
        waiting = []
      }
    },

    aim(next: number) {
      center = next
      sort()
    },
  }
}
