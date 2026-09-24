import { useEffect, useLayoutEffect, useRef } from 'react'
import { Link } from 'react-router'

import { ROUTES, toMyShelfCollection } from '@/shared/config/routes'
import { cn } from '@/shared/lib/cn'
import { opensElsewhere } from '@/shared/lib/opensElsewhere'
import { withReturnPath } from '@/shared/lib/returnPath'

import { boatAnchor } from '../lib/boatAnchor'

type Props = {
  open: boolean
  /** 닫기 요청(Esc · 줄을 골라 떠날 때 · 3D 누름). 부모가 `open` 을 false 로 바꿔야 실제로 닫힙니다 */
  onClose: () => void
  /**
   * 로그인했는가. 아니면 두 줄이 **잠긴 모양**으로 서고 아래에 로그인 한 줄이 붙습니다.
   *
   * ⚠️ 말풍선을 안 띄우는 쪽이 아닙니다 (2026-09-21 사용자 결정) — 배를 눌렀는데 아무 일도
   * 안 일어나면 배가 눌린다는 것 자체를 못 배웁니다.
   */
  isLoggedIn: boolean
  /**
   * 진열대 · 컬렉션을 골랐습니다 — 곧바로 옮겨 가지 않고 **선실로 들어가는 전환**을 걸 자리입니다
   * (2026-09-24 · `shared/ui/DiveCurtain` 의 cabin). 받은 주소로 부르는 쪽이 전환을 겁니다.
   *
   * ⚠️ 안 주면 줄이 평소의 링크로 곧바로 옮겨 갑니다. 새 탭 · 새 창으로 여는 누름(보조키)도
   *   가로채지 않고 링크에 맡깁니다.
   */
  onEnter?: (to: string) => void
}

/** 진열대 — 받침대 둘 위에 선 병 둘 */
const SHELF_ICON = (
  <svg
    viewBox="0 0 32 32"
    className="size-4"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    aria-hidden="true"
  >
    <path d="M4 26 L28 26" />
    <path d="M4 17 L28 17" />
    <path d="M9 17 L9 11 Q9 9 11 9 Q13 9 13 11 L13 17" />
    <path d="M18 17 L18 13 Q18 11 20 11 Q22 11 22 13 L22 17" />
  </svg>
)

/** 컬렉션 — 포개 둔 판 셋 */
const COLLECTION_ICON = (
  <svg
    viewBox="0 0 32 32"
    className="size-4"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M6 20 L16 25 L26 20" />
    <path d="M6 15 L16 20 L26 15" />
    <path d="M6 10 L16 15 L26 10 L16 5 Z" />
  </svg>
)

const LOCK = (
  <svg
    viewBox="0 0 16 16"
    className="size-3"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <rect x="3.5" y="7" width="9" height="6.5" rx="1.5" />
    <path d="M5.75 7 V5 a2.25 2.25 0 0 1 4.5 0 V7" />
  </svg>
)

/** 줄 하나의 틀 — 아이콘 · 이름. 열린 줄과 잠긴 줄이 같은 것을 씁니다 */
const ROW =
  'cabin-row rounded-card flex h-9 items-center gap-2 px-2 no-underline'

function RowFace({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <>
      <span aria-hidden className="text-dusk-gold shrink-0">
        {icon}
      </span>
      <span className="text-body text-surface grow truncate font-serif">
        {label}
      </span>
    </>
  )
}

/**
 * 선실 — 3D 향 지도의 **배 옆에 뜨는 작은 말풍선** (2026-09-21)
 *
 * 배를 누르면 배 옆구리에 꼬리를 대고 열립니다. 줄은 둘뿐입니다 — 진열대 · 컬렉션.
 * 제목도 닫기 단추도 없습니다 (2026-09-21 사용자 : *"배 옆에 바로 뜨는 정말 작은 설정 창 ·
 * 정말 미니멀하고 정말 작게"*). 무엇의 말풍선인지는 **배에 붙어 있다는 것**이 말합니다.
 *
 * ⚠️ **배를 따라다닙니다.** 자리를 rAF 안에서 `transform` 으로 직접 씁니다 — 엔진이 매 프레임
 * 주는 값이라(`lib/boatAnchor`) React 상태로 올리면 초당 60번 화면 전체가 다시 그려집니다.
 * 잠수 커튼이 진행도를 다루는 규율과 같습니다.
 *
 * ⚠️ 나가는 길은 셋입니다 — **3D 아무 데나 누르기**(엔진이 `closeCabin` 으로 알립니다) · Esc ·
 * 줄을 골라 떠나기. 배경을 어둡게 덮지 않으므로 뒤의 바다는 그대로 살아 있습니다.
 * ⚠️ 열리면 말풍선으로 포커스를 옮깁니다 — 3D 는 iframe 이라 키가 그 안에서 끝나서, 안 옮기면
 * Esc 가 이 문서까지 오지 않고 키보드로는 두 줄에 닿을 길이 없습니다.
 */
export function CabinBubble({ open, onClose, isLoggedIn, onEnter }: Props) {
  const box = useRef<HTMLDivElement>(null)

  /*
   * 줄을 누르면 말풍선은 늘 닫힙니다. 그다음 — 부르는 쪽이 전환을 쥐고 있으면 링크를 멈추고 넘깁니다.
   * 전환이 덮은 **뒤에** 옮겨 가야 3D 가 사라진 자리가 한 장도 안 비칩니다 (헤더의 잠수와 같은 규율).
   */
  const enter = (to: string) => (event: React.MouseEvent) => {
    onClose()
    if (!onEnter || opensElsewhere(event)) return
    event.preventDefault()
    onEnter(to)
  }

  useEffect(() => {
    if (open) box.current?.focus()
  }, [open])

  useEffect(() => {
    if (!open) return

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  /*
   * ⭐⭐ **다른 행동을 하면 즉시 닫힙니다** (2026-09-21 사용자 : *"진열대 목록시 또는 지도를 누르거나
   * 다른 행동을 하면 즉시 팝업이 사라지게"*). 팝오버의 규약입니다.
   *
   * ⚠️ **길이 둘이어야 합니다 — 3D 는 다른 문서(iframe)라 이 문서의 누름이 안 옵니다.**
   *   ① `pointerdown`(캡처) — **앱 쪽 전부**. 헤더 '진열대' · 향해 일지 · 검색 · 로그인 …
   *      여태 헤더를 눌러도 말풍선이 남아 잠수 전환 1초 동안 같이 떠 있었습니다.
   *   ② `blur`(창) — **iframe 안 전부**. 미니맵 · 향해 지도 · 엔진 검색창 · 조타.
   *      말풍선이 열릴 때 포커스를 이 문서로 가져오므로(바로 위 effect), iframe 을 건드리는 순간
   *      포커스가 그쪽으로 넘어가며 이 창이 blur 됩니다. 엔진을 안 고치고 그 안 전부를 덮는 한 줄입니다.
   *
   * ⚠️ blur 는 **포커스가 iframe 으로 갔을 때만** 닫습니다. 다른 탭 · 다른 앱으로 옮긴 것은
   *   '행동' 이 아니라 자리 비움이라, 돌아왔을 때 말풍선이 사라져 있으면 누른 적 없는 것이 닫힙니다.
   * ⚠️ 캡처 단계지만 말풍선 **안**이면 건너뜁니다 — 안 그러면 줄(Link)을 누르는 순간 닫혀 이동이 죽습니다.
   * ⚠️ 엔진도 3D 누름 · ESC 를 이미 닫습니다 (`main.js` 의 `onPick` · `onKeyExit`). 겹쳐도
   *   `closeCabin` 이 멱등이라 두 번 닫히는 일은 없습니다.
   */
  useEffect(() => {
    if (!open) return

    const onDown = (event: PointerEvent) => {
      const el = box.current
      if (el && event.target instanceof Node && el.contains(event.target))
        return
      onClose()
    }
    const onBlur = () => {
      if (document.activeElement?.tagName === 'IFRAME') onClose()
    }
    window.addEventListener('pointerdown', onDown, true)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('blur', onBlur)
    }
  }, [open, onClose])

  /*
   * 배를 따라다니기. 엔진이 채운 꼬리 점(ax · ay · side)을 읽어 자리를 씁니다.
   *
   * ⚠️ 값이 바뀔 때만 씁니다 — 배가 멈춰 있으면 DOM 을 안 건드립니다.
   * ⚠️ 엔진이 없거나(3D 가 아직 안 떴다) 값이 낡았으면 **숨깁니다.** 0,0 은 화면 왼쪽 위라,
   *   자리를 모르는 채로 그리면 거기에 한 장이 찍힙니다 (아래 ⚠⚠).
   */
  const placed = useRef('')
  const place = () => {
    const el = box.current
    if (!el) return
    const anchor = boatAnchor()
    if (!anchor) {
      el.style.visibility = 'hidden'
      return
    }

    const key = `${anchor.ax.toFixed(1)}|${anchor.ay.toFixed(1)}|${anchor.side}`
    if (key === placed.current) return
    placed.current = key

    el.style.transform = `translate3d(${anchor.ax.toFixed(1)}px, ${anchor.ay.toFixed(1)}px, 0)`
    el.dataset.side = anchor.side > 0 ? 'right' : 'left'
    el.style.visibility = 'visible'
  }

  /*
   * ⚠⚠ **첫 자리는 칠하기 _전_에 잡습니다** (`useLayoutEffect`).
   *
   * 바깥 칸은 `top-0 left-0` 이라 transform 이 없으면 **화면 왼쪽 위**입니다. 자리를 rAF 에만
   * 맡기면 그 rAF 는 이미 칠해진 _다음_에 돌아서, **한 장 동안 말풍선이 왼쪽 위에 찍히고
   * 모핑도 거기서 시작합니다** (2026-09-21 사용자가 본 것). `useLayoutEffect` 는 DOM 을 바꾼
   * 직후 · 칠하기 직전에 돌므로 첫 장부터 제자리입니다.
   * ⚠️ 그래도 못 잡을 때(엔진이 아직 없다)를 위해 JSX 가 `visibility: hidden` 으로 시작합니다 —
   *   자리를 못 쓰면 안 보이는 채로 두고, 자리가 오는 첫 장에 같이 보입니다.
   * ⚠️ 다시 열릴 때는 DOM 이 새것이라 기억한 자리를 버립니다 (안 버리면 새 요소에 안 씁니다).
   */
  useLayoutEffect(() => {
    if (!open) return
    placed.current = ''
    place()
  }, [open])

  useEffect(() => {
    if (!open) return

    let raf = 0
    const follow = () => {
      raf = requestAnimationFrame(follow)
      place()
    }
    raf = requestAnimationFrame(follow)
    return () => cancelAnimationFrame(raf)
  }, [open])

  // 닫혀 있으면 안 그립니다 — 열릴 때마다 다시 마운트되어 들어오는 결이 살아납니다
  if (!open) return null

  return (
    /*
      바깥 칸은 **꼬리를 대는 점**(배 옆구리)에 섭니다. 말풍선 상자는 그 점에서 CSS 로 비켜서므로,
      rAF 는 점 하나만 밀면 됩니다 — 상자 크기(로그인 여부에 따라 다릅니다)를 몰라도 됩니다.
    */
    <div
      ref={box}
      data-side="right"
      role="dialog"
      aria-label="선실"
      tabIndex={-1}
      /*
        ⚠️ **안 보이는 채로 태어납니다.** 이 칸은 `top-0 left-0` 이라 자리를 쓰기 전에는 화면
        왼쪽 위이고, 거기서 한 장이라도 칠해지면 모핑이 왼쪽 위에서 시작하는 것으로 보입니다.
        바로 위 `useLayoutEffect` 가 첫 칠 전에 자리를 잡으며 같이 보이게 합니다.
      */
      style={{ visibility: 'hidden' }}
      className="cabin-anchor absolute top-0 left-0 z-10 outline-none"
    >
      {/*
        꼬리 — 45도 돌린 작은 정사각형. 엔진의 호버 방울과 **같은 점 · 같은 모양**입니다.
        ⚠️ 말풍선의 **형제**입니다(자식이 아닙니다) — 자라는 모습을 말풍선의 `clip-path` 로 내는데,
          꼬리가 그 안에 있으면 상자 밖으로 나간 꼬리가 통째로 잘립니다.
      */}
      <span aria-hidden className="cabin-bubble-tail" />

      <div className="cabin-bubble">
        <div className="relative flex w-40 flex-col gap-1 p-1.5">
          {isLoggedIn ? (
            <>
              <Link
                to={ROUTES.MY_SHELF}
                onClick={enter(ROUTES.MY_SHELF)}
                className={cn(
                  ROW,
                  'cabin-row-open focus-visible:ring-dusk-gold outline-none focus-visible:ring-2',
                )}
              >
                <RowFace icon={SHELF_ICON} label="진열대" />
              </Link>

              {/* 아래 줄이 한 단 가라앉습니다 — "컬렉션은 진열대 아래 칸" 을 말 대신 깊이로 */}
              <Link
                to={toMyShelfCollection()}
                onClick={enter(toMyShelfCollection())}
                className={cn(
                  ROW,
                  'cabin-row-open cabin-row-lower focus-visible:ring-dusk-gold outline-none focus-visible:ring-2',
                )}
              >
                <RowFace icon={COLLECTION_ICON} label="컬렉션" />
              </Link>
            </>
          ) : (
            <>
              {/*
                잠긴 두 줄. 누를 수 없으니 링크가 아니라 그냥 줄입니다 — 눌리지 않는 것을 링크로
                두면 낭독기에서 '링크' 로 읽히고, 새 탭으로 열면 로그인 화면이 아니라 빈 진열대가 뜹니다
              */}
              <span className={cn(ROW, 'opacity-50')}>
                <RowFace icon={SHELF_ICON} label="진열대" />
                <span aria-hidden className="text-surface/85 shrink-0">
                  {LOCK}
                </span>
              </span>
              <span className={cn(ROW, 'cabin-row-lower opacity-50')}>
                <RowFace icon={COLLECTION_ICON} label="컬렉션" />
                <span aria-hidden className="text-surface/85 shrink-0">
                  {LOCK}
                </span>
              </span>

              <Link
                to={withReturnPath(ROUTES.LOGIN, ROUTES.HOME)}
                onClick={onClose}
                className="text-caption text-dusk-gold focus-visible:ring-dusk-gold rounded-card px-2 py-0.5 underline underline-offset-2 outline-none focus-visible:ring-2"
              >
                로그인이 필요합니다
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
