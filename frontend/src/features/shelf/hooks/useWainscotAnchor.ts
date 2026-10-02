import { useCallback, type RefCallback } from 'react'

/** 판벽 높이를 받는 CSS 변수 — shelf-display.css 의 .shelf-wainscot 이 읽습니다 */
const WAINSCOT_TOP = '--wainscot-top'

/** 진열대 화면 래퍼. 판벽을 그리는 ShelfPaper 가 이 안에 서서 변수를 물려받습니다 */
const SCOPE = '.shelf-scope'

/**
 * 판벽의 징두리 띠를 궤짝(벽감) 아래끝에 맞춥니다 — 궤짝 아래끝의 화면 높이(px)를 진열대 화면
 * 래퍼(`.shelf-scope`)의 `--wainscot-top` 에 적고, 판벽(ShelfPaper 의 .shelf-wainscot)이 그 값을 읽습니다.
 *
 * 화면 높이의 몇 % 로 못 박지 않는 까닭: 궤짝 높이는 창 폭 · 높이 둘 다에서 셈해서(lib.ts 의 shelfLayout)
 * 창 비율마다 아래끝이 다른 자리에 옵니다. 1920 x 1080 에서 75% 이던 것이 1920 x 947 에서는 62% 라,
 * 고정값이면 띠가 궤짝보다 135px 아래로 떨어집니다.
 *
 * 높이는 **배치된 자리(offsetTop)로** 잽니다. getBoundingClientRect 는 무대 바꾸기(ShelfDeck 의 translate)를
 * 따라가서, 컬렉션 무대로 올라가면 판벽이 궤짝을 따라 화면 위로 끌려 올라갑니다. 판벽은 무대가 아니라
 * 방의 벽이라 제자리에 남아야 합니다.
 *
 * 크기가 바뀔 때(창 · 궤짝)와 페이지가 스크롤될 때 다시 적습니다 — 세로가 낮은 창에서는 한 장 배치도 조금
 * 스크롤되는데 판벽은 화면에 고정된 겹이라, 그대로 두면 궤짝과 어긋납니다. 값은 React 상태가 아니라 래퍼에
 * **직접** 씁니다. 상태로 들면 스크롤 한 번마다 진열대 화면 전체가 다시 그려집니다.
 *
 * 궤짝 요소에 거는 ref 콜백을 돌려줍니다. 요소가 바뀌면(크기를 잰 뒤 처음 그려질 때 · 다시 그려질 때) 옛
 * 요소의 알림을 걷고 새 요소에 겁니다 — 처음 잡은 요소를 쥐고 있으면, 그 요소가 문서에서 빠진 뒤로는
 * 잴 자리가 없어 띠가 옛 높이에 멈춥니다.
 *
 * @param enabled 판벽을 세울지. 끄면 값을 지워 판벽을 거둡니다
 * @returns 궤짝(벽감) 요소에 거는 ref
 */
export function useWainscotAnchor(enabled: boolean): RefCallback<HTMLElement> {
  return useCallback(
    (el: HTMLElement | null) => {
      const scope = el?.closest<HTMLElement>(SCOPE)
      if (!enabled || !el || !scope) return

      /*
       * 알림을 받은 그 자리에서 적습니다. requestAnimationFrame 으로 미루지 않습니다 — 크기 알림
       * (ResizeObserver)과 스크롤은 이미 한 장에 한 번꼴로 오고, rAF 는 탭이 가려진 동안 멈춰서 그사이
       * 바뀐 창 크기를 놓친 채 띠가 옛 자리에 남았습니다. 적는 값은 판벽(고정 겹)만 옮겨 래퍼의 크기를
       * 바꾸지 않으므로, 크기 알림이 되돌아오는 고리도 없습니다.
       */
      const write = () => {
        const bottom = layoutBottom(el, scope)
        if (bottom === null) return
        const top = scope.getBoundingClientRect().top + bottom
        scope.style.setProperty(WAINSCOT_TOP, `${Math.round(top)}px`)
      }

      write()
      const observer =
        typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(write)
      observer?.observe(el)
      observer?.observe(scope)
      window.addEventListener('scroll', write, { passive: true })
      window.addEventListener('resize', write)
      return () => {
        observer?.disconnect()
        window.removeEventListener('scroll', write)
        window.removeEventListener('resize', write)
        scope.style.removeProperty(WAINSCOT_TOP)
      }
    },
    [enabled],
  )
}

/**
 * `ancestor` 안에서 `el` 아래끝까지의 높이 — 변환(transform)을 빼고 배치된 자리로 잽니다.
 *
 * @returns `ancestor` 가 offsetParent 사슬에 없으면(위치가 static 이면) null
 */
function layoutBottom(el: HTMLElement, ancestor: HTMLElement): number | null {
  let y = el.offsetHeight
  let node: Element | null = el
  while (node instanceof HTMLElement && node !== ancestor) {
    y += node.offsetTop
    node = node.offsetParent
  }
  return node === ancestor ? y : null
}
