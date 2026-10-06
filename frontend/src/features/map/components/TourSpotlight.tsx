import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent,
} from 'react'
import { createPortal } from 'react-dom'

import { cn } from '@/shared/lib/cn'
import { useGraphicsStore } from '@/shared/store/graphicsStore'
import {
  TOUR_SPOTLIGHT,
  useTourStore,
  type TourStep,
} from '@/shared/store/tourStore'

import { freezeTourScene, tourAnchor } from '../lib/tourAnchor'

type Box = { x: number; y: number; w: number; h: number }
/** 밝힐 상자(여백까지) · 안내와 겹칠 때 감싸지 않고 안내 쪽을 물리는가 (`spotlightPath`) */
type Target = { box: Box; trim: boolean }

/** 앱이 그리는 것을 가리키는 단계 — 그 자리에 단 `data-tour-target` 으로 찾습니다. 나머지는 엔진이 잽니다(`tourAnchor`) */
const APP_TARGETS: readonly TourStep[] = ['search', 'log', 'results']

/**
 * 가리킨 것의 둘레 여백. 엔진 쪽 안내는 그것에서 10px 떨어져 서서(`tourPlacement` 의 GAP), 6 이면 두 구멍 사이에
 * 4px 이 남습니다 — 8 이면 2px 실금이 집니다.
 * NOTE: 엔진이 준 밝힐 상자(`hole`)에는 더하지 않습니다 — 엔진이 이미 여백을 둔 상자입니다(부표 8 · 배 12).
 *   더하면 부표의 구멍이 늘 안내와 겹쳐 둘을 감싼 넓은 상자가 되고, 옆 부표 · 이름표까지 밝혀 눌립니다.
 */
const PAD = 6
const TARGET_RADIUS = 12
/** 안내 종이의 모서리 — `TourTip` 의 `rounded-[14px]` 와 같아야 구멍이 종이에 꼭 맞습니다 */
const TIP_RADIUS = 14
const FILL_OPACITY = { light: '0.4', dim: '0.8' } as const
/**
 * 안내가 이만큼(ms) 안에 돌아오면 걷힌 것으로 치지 않습니다 — 3D 를 되살리지도 초점을 돌려주지도 않습니다.
 * 엔진 쪽 안내는 부표 · 카드가 자리를 바꾸는 동안 한두 장 자리를 못 잽니다(`SceneTourTip` 이 숨깁니다).
 */
const BLIP_MS = 400

/**
 * 결과창 안의 안내 위로 막을 올릴 수 있는가 — popover(top layer)가 없는 브라우저(Firefox 125 · Safari 17 전)는 막이
 * 그 창 위층에 못 오르고, 그 창의 backdrop-filter 가 fixed 의 기준이 되어 구멍이 창의 자리만큼 어긋납니다.
 * 그때 결과 안내는 덮지 않습니다.
 */
const CAN_LIFT =
  typeof HTMLElement !== 'undefined' &&
  typeof HTMLElement.prototype.showPopover === 'function'

const toBox = (rect: DOMRect): Box => ({
  x: rect.left,
  y: rect.top,
  w: rect.width,
  h: rect.height,
})

const pad = ({ x, y, w, h }: Box): Box => ({
  x: x - PAD,
  y: y - PAD,
  w: w + PAD * 2,
  h: h + PAD * 2,
})

const overlaps = (a: Box, b: Box) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h

const union = (a: Box, b: Box): Box => {
  const x = Math.min(a.x, b.x)
  const y = Math.min(a.y, b.y)
  return {
    x,
    y,
    w: Math.max(a.x + a.w, b.x + b.w) - x,
    h: Math.max(a.y + a.h, b.y + b.h) - y,
  }
}

/** 보이는 틀(화면 · 결과창) 안으로 자릅니다. 틀 밖이면 null */
const clip = (box: Box, frame: Box): Box | null => {
  const x = Math.max(box.x, frame.x)
  const y = Math.max(box.y, frame.y)
  const w = Math.min(box.x + box.w, frame.x + frame.w) - x
  const h = Math.min(box.y + box.h, frame.y + frame.h) - y
  return w > 0 && h > 0 ? { x, y, w, h } : null
}

/**
 * 밝힐 상자에서 안내가 걸친 쪽을 안내 끝까지 물립니다 — 위 · 아래 · 왼 · 오른쪽으로 물린 넷 가운데 가장 넓게 남는 것.
 * 다 물려 남는 것이 없으면(안내가 상자를 다 덮었으면) null
 */
const trim = (lit: Box, paper: Box): Box | null => {
  const right = paper.x + paper.w
  const bottom = paper.y + paper.h
  let best: Box | null = null
  for (const cut of [
    { ...lit, y: bottom, h: lit.y + lit.h - bottom },
    { ...lit, h: paper.y - lit.y },
    { ...lit, x: right, w: lit.x + lit.w - right },
    { ...lit, w: paper.x - lit.x },
  ]) {
    if (cut.w <= 0 || cut.h <= 0) continue
    if (!best || cut.w * cut.h > best.w * best.h) best = cut
  }
  return best
}

const px = (value: number) => Math.round(value * 10) / 10

const roundedRect = ({ x, y, w, h }: Box, radius: number) => {
  const r = px(Math.min(radius, w / 2, h / 2))
  const [left, top, right, bottom] = [px(x), px(y), px(x + w), px(y + h)]
  const arc = `A${r} ${r} 0 0 1`
  return (
    `M${px(left + r)} ${top}H${px(right - r)}${arc} ${right} ${px(top + r)}` +
    `V${px(bottom - r)}${arc} ${px(right - r)} ${bottom}H${px(left + r)}` +
    `${arc} ${left} ${px(bottom - r)}V${px(top + r)}${arc} ${px(left + r)} ${top}Z`
  )
}

/**
 * 막의 모양 — 화면 전체에서 가리킨 것과 안내 종이를 뚫습니다 (`fill-rule: evenodd`).
 *
 * NOTE: 두 구멍이 겹치면 evenodd 가 겹친 곳을 다시 칠해, 안내 한 자락이 덮이고 그 누름이 막힙니다 —
 *   겹칠 때는 둘을 감싼 상자 하나로 뚫습니다. 엔진이 준 상자(`target.trim`)는 감싸지 않고 안내 쪽을 물립니다
 *   (`trim`) — 감싸면 안내 폭(380px 까지)만큼 옆 부표 · 바다가 밝혀져 눌리고, 배 옆구리에 붙는 배 안내는 늘 걸칩니다.
 *
 * @param target 밝힐 상자 (뷰포트 CSS px · 여백까지) · 겹칠 때 물릴지
 * @param tip 안내 종이 (뷰포트 CSS px)
 * @param frame 구멍이 보일 수 있는 틀 — 화면, 결과창 안의 안내면 그 창
 * @returns SVG 길의 `d`. 둘 중 하나라도 틀 밖이면 null (막을 걷습니다)
 */
function spotlightPath(target: Target, tip: Box, frame: Box) {
  const lit = clip(target.box, frame)
  const paper = clip(tip, frame)
  if (!lit || !paper) return null
  let holes = roundedRect(lit, TARGET_RADIUS) + roundedRect(paper, TIP_RADIUS)
  if (overlaps(lit, paper)) {
    const cut = target.trim ? trim(lit, paper) : null
    holes = cut
      ? roundedRect(cut, TARGET_RADIUS) + roundedRect(paper, TIP_RADIUS)
      : roundedRect(union(lit, paper), TARGET_RADIUS)
  }
  return `M0 0H${window.innerWidth}V${window.innerHeight}H0Z${holes}`
}

/**
 * 종이가 다 보이는가 — 가운데와 네 모서리 안쪽을 짚어 맨 위가 그 종이인지 봅니다(막 자신은 뺍니다).
 * 넘친 것을 자르는 조상에 잘린 동안(결과창이 펼쳐지는 동안 · 검색창 밑 띠로 미끄러져 들어오는 동안)이나
 * 화면 밖이면 false 입니다.
 */
function fullyShown(el: HTMLElement, box: Box, mask: Element | null) {
  const inset = Math.min(TIP_RADIUS + 2, box.w / 2, box.h / 2)
  const xs = [box.x + inset, box.x + box.w - inset]
  const ys = [box.y + inset, box.y + box.h - inset]
  const points: [number, number][] = [
    [box.x + box.w / 2, box.y + box.h / 2],
    ...xs.flatMap((x) => ys.map((y): [number, number] => [x, y])),
  ]
  return points.every(([x, y]) => {
    const top = document
      .elementsFromPoint(x, y)
      .find((hit) => !mask?.contains(hit))
    return !!top && el.contains(top)
  })
}

/**
 * 지금 보이는 안내 종이 — 한 번에 하나뿐입니다(`tourStore`). 없거나 · 아직 숨어 있거나(자리를 잡기 전) ·
 * 다 보이기 전이면(`fullyShown`) null
 */
function readTip(mask: Element | null) {
  const el = document.querySelector<HTMLElement>('[data-tour-tip]')
  if (!el) return null
  const rect = el.getBoundingClientRect()
  if (rect.width === 0 || rect.height === 0) return null
  if (getComputedStyle(el).visibility === 'hidden') return null
  const box = toBox(rect)
  if (!fullyShown(el, box, mask)) return null
  return { el, box }
}

/**
 * 그 단계가 가리킨 것. 앱 쪽 단계는 같은 표시를 여러 곳에 달면 그 모두를 감싼 상자를 밝힙니다.
 * 엔진 쪽 단계는 밝힐 상자(`hole`)가 따로 있으면 그것을(여백 없이 · 겹치면 물립니다), 없으면 안내가 붙는 상자를 밝힙니다.
 *
 * NOTE: 닮은 향수(similar)인데 밝힐 상자가 없으면 엔진이 안내를 카드에 붙인 것입니다 — 떠오른 12개가 띠 밖
 *   (하늘 · 바다 끝)이라 붙을 이름표가 없을 때입니다(`main.js` 의 `tourSimilarBox`). 그때는 덮지 않습니다 —
 *   카드만 밝히면 안내가 누르라는 12개가 다 막 밑에 깔려 못 누릅니다.
 */
function readTarget(step: TourStep): Target | null {
  if (APP_TARGETS.includes(step)) {
    let box: Box | null = null
    for (const el of document.querySelectorAll(
      `[data-tour-target="${step}"]`,
    )) {
      const rect = el.getBoundingClientRect()
      if (rect.width === 0 && rect.height === 0) continue
      box = box ? union(box, toBox(rect)) : toBox(rect)
    }
    return box && { box: pad(box), trim: false }
  }
  const anchor = tourAnchor()
  if (!anchor) return null
  if (anchor.hole) return { box: anchor.hole, trim: true }
  if (step === 'similar') return null
  return { box: pad(anchor), trim: false }
}

/** 덮인 곳을 눌러도 초점이 안내 단추에서 빠지지 않게 합니다 */
const keepFocus = (event: MouseEvent) => event.preventDefault()

/**
 * 첫 방문 안내의 스포트라이트 — 안내가 서 있는 동안 화면 전체를 검게 덮고 **안내와 그것이 가리킨 것만** 구멍으로
 * 남깁니다. 세기는 단계마다 `TOUR_SPOTLIGHT` 가 정하고(none 이면 덮지 않습니다), 짙게 덮는 단계(dim)는 그동안 3D 도
 * 멈춥니다(`freezeTourScene`). 메인 화면에 한 번만 둡니다.
 *
 * 막은 SVG 길 한 줄이고 **칠한 곳만** 누름을 받습니다 — 덮인 곳의 누름은 아무 일도 안 하고, 구멍 안은 그 밑
 * (3D iframe · 검색창 · 향해 일지 · 결과 카드)이 그대로 받습니다.
 *
 * 자리는 `SceneTourTip` 과 같은 규율로 제 rAF 안에서 읽어 값이 바뀔 때만 DOM 에 씁니다 — 안내 종이는
 * `data-tour-tip`, 가리킨 것은 엔진 쪽 단계면 `tourAnchor()`, 앱 쪽 단계(search · log · results)면 `data-tour-target`.
 *
 * NOTE: **안내가 실제로 보일 때만 덮습니다.** 종이가 없거나 · 자리를 잡기 전이라 숨어 있거나(`SceneTourTip` 의
 *   visibility) · 잘려서 다 보이기 전이거나(`fullyShown`) · 가리킬 것을 못 쟀으면 막을 걷고 누름도 통과시킵니다 —
 *   안내 없이 화면만 막히면 나갈 길이 없습니다.
 * NOTE: 안내 종이 자리도 뚫습니다. 엔진 쪽 안내는 헤더 밑(z-10)이고 결과 안내는 결과창 안이라 쌓임 순서로는 막 위에
 *   못 올립니다 — 뚫어 두면 어느 쌓임 맥락에 있든 막 위에 선 것처럼 보이고 눌립니다.
 * NOTE: 막은 z-50 입니다 — 헤더(z-20) · 의견 단추 · 토스트(z-40) 위, 잠수 커튼 · 로딩 커튼(z-100) 아래. 추천 결과창은
 *   `<dialog>` 의 위층(top layer)이라 z-index 로는 못 넘어, 결과 안내가 그 창 안에 서면 막을 그 창 안으로 옮겨
 *   popover 로 한 겹 더 위에 올립니다. 창 밖에 두면 모달 바깥이라 inert 가 됩니다. popover 가 없는 브라우저는
 *   결과 안내를 덮지 않습니다(`CAN_LIFT`).
 * NOTE: 단계가 끝나도 막을 바로 빼지 않고 투명하게 둡니다 — 끝낸 순간 사라지지 않고 걷히게 합니다(누름은 곧바로 통과).
 *   걷히는 움직임은 OS 의 '동작 줄이기' · 사이트의 '움직임 줄이기'(`graphicsStore.calm`)에서 뺍니다.
 */
export function TourSpotlight() {
  const active = useTourStore((state) => state.active)
  const calm = useGraphicsStore((state) => state.calm)
  const strength = active ? TOUR_SPOTLIGHT[active] : 'none'
  const layer = useRef<HTMLDivElement>(null)
  const path = useRef<SVGPathElement>(null)
  /** 안내가 결과창(`<dialog>`) 안에 섰는가 — 그 단계 동안만 막을 그 창 안으로 옮깁니다 */
  const [dialog, setDialog] = useState<{
    step: TourStep
    el: HTMLDialogElement | null
  } | null>(null)
  const host = dialog?.step === active ? dialog.el : null

  useEffect(() => {
    if (!active || strength === 'none') return
    const step = active
    const fillOpacity = FILL_OPACITY[strength]

    let raf = 0
    let shown = false
    /** 이 단계에서 3D 를 멈춘 적이 있는가 · 지금 멈춰 있는가 */
    let froze = false
    let frozen = false
    let focused = false
    let restoreTo: HTMLElement | null = null
    let tipEl: HTMLElement | null = null
    let syncedDialog: HTMLDialogElement | null | undefined
    /** 덮은 뒤 안내가 숨은 때 (`BLIP_MS`) · null 이면 숨지 않았습니다 */
    let hiddenAt: number | null = null

    const paint = (on: boolean, d?: string) => {
      const el = layer.current
      const shape = path.current
      if (!el || !shape) return
      const flag = String(on)
      if (el.dataset.shown !== flag) {
        el.dataset.shown = flag
        el.style.opacity = on ? '1' : '0'
        shape.style.pointerEvents = on ? 'auto' : 'none'
        if (on) shape.setAttribute('fill-opacity', fillOpacity)
      }
      if (d && shape.getAttribute('d') !== d) shape.setAttribute('d', d)
    }

    /*
      키보드로도 안내를 읽고 넘기게 안내 종이에 초점을 줍니다 — 스크린리더가 그 말을 읽고, Tab 하면 그 안의 단추로 갑니다.
      NOTE: 단추가 아니라 종이입니다. [다음 →] 에 주면 누르지 않았는데도 그 단추에 초점 테가 섰습니다 — 스크립트가
        옮긴 초점에도 브라우저가 테를 그립니다. 종이는 테가 없습니다(`TourTip` 의 `tabIndex={-1}` · `outline-none`).
      NOTE: 검색 안내(search)는 초점을 옮기지 않습니다. 그 종이는 검색창의 시작 칸(`data-starter`) 안이라 초점이 그 안으로
        가면 검색창이 안내를 읽기도 전에 시작 문장을 펼칩니다(`SceneSearchBar` 의 onFocus — 그 줄도 `data-tour-target`
        으로 같이 밝힙니다). 입력칸에 적고 있던 사람은 초점을 뺏기면 적던 말이 끊깁니다.
    */
    const focusPaper = (tip: HTMLElement) => tip.focus({ preventScroll: true })
    const focusTip = (tip: HTMLElement) => {
      if (step === 'search') return
      const now = document.activeElement
      restoreTo =
        now instanceof HTMLElement && now !== document.body ? now : null
      focusPaper(tip)
    }

    /*
      막이 걷히면 초점을 돌려줍니다 — 3D(iframe)였으면 방향키가 다시 배를 몹니다.
      사람이 그새 옮긴 초점(구멍 안의 3D · 결과 카드)은 그대로 둡니다 — 초점이 아직 안내 안이거나, 안내와 함께 단추가
      빠져 갈 곳을 잃었을 때만입니다.
    */
    const restoreFocus = () => {
      const to = restoreTo
      restoreTo = null
      if (!to?.isConnected) return
      const now = document.activeElement
      if (now && now !== document.body && !tipEl?.contains(now)) return
      to.focus({ preventScroll: true })
    }

    const hide = () => {
      paint(false)
      if (!shown) return
      shown = false
      if (frozen) {
        frozen = false
        freezeTourScene(false)
      }
      restoreFocus()
    }

    const frame = () => {
      raf = requestAnimationFrame(frame)
      const tip = readTip(layer.current)
      const target = tip && readTarget(step)
      const inDialog = tip?.el.closest('dialog') ?? null
      const view = inDialog
        ? toBox(inDialog.getBoundingClientRect())
        : { x: 0, y: 0, w: window.innerWidth, h: window.innerHeight }
      const d =
        tip &&
        target &&
        (!inDialog || CAN_LIFT) &&
        spotlightPath(target, tip.box, view)
      if (!tip || !d) {
        /*
          막은 곧바로 걷습니다(누름도 통과) — 안내 없이 화면이 막히면 안 됩니다.
          NOTE: 3D 를 되살리고 초점을 돌려주는 것(hide)은 `BLIP_MS` 넘게 숨었을 때만입니다. 한두 장 숨을 때마다 하면
            짙은 단계의 3D 가 그 단계 내내 되살아난 채로 남고(멈춤은 단계마다 한 번), 초점은 3D 로 가 버립니다.
        */
        paint(false)
        if (!shown) return
        const now = performance.now()
        hiddenAt ??= now
        if (now - hiddenAt >= BLIP_MS) hide()
        return
      }
      if (inDialog !== syncedDialog) {
        syncedDialog = inDialog
        setDialog({ step, el: inDialog })
      }
      tipEl = tip.el
      paint(true, d)
      if (shown) {
        // 잠깐 숨은 사이 종이와 함께 초점을 잃었으면(숨은 요소는 초점이 빠집니다) 다시 줍니다
        if (
          hiddenAt !== null &&
          focused &&
          document.activeElement === document.body
        )
          focusPaper(tip.el)
        hiddenAt = null
        return
      }
      hiddenAt = null
      shown = true
      /*
        멈추는 것은 이 단계에서 처음 덮을 때 한 번뿐입니다. 3D 안을 누르면 엔진이 스스로 다시 돌리는데,
        그 뒤에 다시 멈추면 누른 사람의 손 밑에서 바다가 서 버립니다.
      */
      if (strength === 'dim' && !froze) {
        froze = true
        frozen = true
        freezeTourScene(true)
      }
      if (!focused) {
        focused = true
        focusTip(tip.el)
      }
    }

    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      hide()
    }
  }, [active, strength])

  // 결과창 안으로 옮긴 막을 그 창 위층에 올립니다 (위 머리말의 top layer)
  useLayoutEffect(() => {
    const el = layer.current
    if (!host || !el || typeof el.showPopover !== 'function') return
    try {
      el.showPopover()
    } catch {
      // 이미 떠 있습니다
    }
  }, [host])

  // 덮인 곳의 휠이 그 밑(결과창)을 굴리지 않게 합니다 — React 의 onWheel 은 passive 라 기본 동작을 못 막습니다
  useEffect(() => {
    const el = layer.current
    if (!el) return
    const stop = (event: WheelEvent) => event.preventDefault()
    el.addEventListener('wheel', stop, { passive: false })
    return () => el.removeEventListener('wheel', stop)
  }, [host])

  const mask = (
    <div
      ref={layer}
      aria-hidden
      data-tour-spotlight=""
      popover={host ? 'manual' : undefined}
      className={cn(
        'pointer-events-none fixed inset-0 z-50 touch-none opacity-0',
        'transition-opacity duration-200 ease-out motion-reduce:transition-none',
        calm && 'transition-none',
        // popover 에 브라우저가 주는 테두리 · 바탕 · 여백 · 크기를 걷습니다
        host &&
          'm-0 size-full max-h-none max-w-none overflow-hidden border-0 bg-transparent p-0',
      )}
    >
      <svg className="size-full">
        <path
          ref={path}
          fillRule="evenodd"
          className="pointer-events-none"
          onMouseDown={keepFocus}
        />
      </svg>
    </div>
  )

  return host ? createPortal(mask, host) : mask
}
