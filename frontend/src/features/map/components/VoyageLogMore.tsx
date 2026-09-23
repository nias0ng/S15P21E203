import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'

import { cn } from '@/shared/lib/cn'

/** '…' 에서 카드로 마우스를 옮기는 동안 기다리는 시간 — 둘 사이의 틈을 건너는 사이에 닫히지 않게 */
const CLOSE_DELAY_MS = 150

/** 카드가 창 끝에 붙지 않게 두는 여백 (px) */
const VIEWPORT_EDGE = 10

/** 올려 두는 것(hover)이 있는 포인터인지 — 손가락은 올려 둘 수 없어 눌러서 엽니다 */
const canHover = (pointerType: string) =>
  pointerType === 'mouse' || pointerType === 'pen'

type Props = {
  /** '…' 을 읽어 주는 이름. 보이는 글자가 '…' 하나라 무엇이 더 있는지는 이 이름이 말합니다 */
  label: string
  /** 가린 나머지. 없으면 '…' 도 카드도 없습니다 */
  more: ReactNode | null
  /** 보이는 것. '…' 을 어디에 붙일지는 부르는 쪽이 정합니다 (해역은 줄 끝 · 향수는 다음 줄) */
  children: (trigger: ReactNode) => ReactNode
  /** '…' 의 모양을 옆 내용에 맞출 때 — 해역은 뱃지와 같은 알약입니다 */
  triggerClassName?: string
}

/**
 * 향해 일지의 '…' — 가린 나머지를 판 오른쪽의 작은 카드로 띄웁니다.
 *
 * - 마우스 · 펜은 '…' 에 올리면 열리고, '…' 이 든 칸과 카드 밖으로 나가면 닫힙니다. 카드 안으로
 *   옮겨 향수를 누를 수 있게, 둘 사이의 틈을 건너는 동안은 닫지 않고 기다립니다
 * - 올려 둘 수 없는 손가락 · 키보드는 눌러서 열고 닫습니다. 바깥을 누르거나 Esc 로도 닫힙니다
 * - 카드는 판(`VoyageLog` 의 section)을 기준으로 섭니다. 사이의 목록 · 접기 칸은 넘친 것을 자르지만
 *   카드의 기준이 그 바깥이라 잘리지 않습니다. 대신 목록이 굴러가면 자리가 어긋나 닫습니다
 */
export function VoyageLogMore({
  label,
  more,
  children,
  triggerClassName,
}: Props) {
  const [open, setOpen] = useState(false)
  // 마우스가 나갔고, 잠시 뒤 닫힐 참입니다. 다시 들어오면 거둡니다
  const [leaving, setLeaving] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  // 누른 포인터 — click 은 어떤 포인터로 눌렀는지 모든 브라우저가 알려 주지는 않습니다
  const pressedWith = useRef('')
  const cardId = useId()

  useEffect(() => {
    if (!leaving) return
    const timer = window.setTimeout(() => {
      setOpen(false)
      setLeaving(false)
    }, CLOSE_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [leaving])

  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    const onScroll = (event: Event) => {
      // 카드 안의 긴 목록을 굴리는 것은 괜찮습니다
      if (!cardRef.current?.contains(event.target as Node)) close()
    }
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close()
    }
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', close)
    document.addEventListener('pointerdown', onPointerDown)
    return () => {
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', close)
      document.removeEventListener('pointerdown', onPointerDown)
    }
  }, [open])

  /*
   * 카드 자리 — 칠하기 전에 잡습니다. 카드의 첫 줄이 '…' 과 같은 높이에 오게 카드의 위 안쪽 여백만큼
   * 올리고, 창 아래로 넘치면(좁은 창에서는 판이 화면 아래에 붙습니다) 넘친 만큼 올립니다.
   * 창 오른쪽으로 넘치는 아주 좁은 창에서는 판 위로 겹쳐 당깁니다.
   */
  useLayoutEffect(() => {
    const card = cardRef.current
    const trigger = triggerRef.current
    const host = card?.offsetParent
    if (!open || !card || !trigger || !(host instanceof HTMLElement)) return

    const padTop = parseFloat(getComputedStyle(card).paddingTop) || 0
    const top =
      trigger.getBoundingClientRect().top -
      host.getBoundingClientRect().top -
      padTop
    card.style.top = `${top}px`

    const rect = card.getBoundingClientRect()
    const below = rect.bottom - (window.innerHeight - VIEWPORT_EDGE)
    if (below > 0) card.style.top = `${top - below}px`
    const right = rect.right - (window.innerWidth - VIEWPORT_EDGE)
    if (right > 0) card.style.transform = `translateX(${-right}px)`
  }, [open])

  const trigger = more ? (
    <button
      ref={triggerRef}
      type="button"
      aria-label={label}
      aria-expanded={open}
      aria-controls={open ? cardId : undefined}
      onPointerEnter={(event) => {
        if (!canHover(event.pointerType)) return
        setLeaving(false)
        setOpen(true)
      }}
      onPointerDown={(event) => {
        pressedWith.current = event.pointerType
      }}
      onClick={() => {
        // 마우스는 올린 순간 이미 열렸습니다 — 눌러도 닫지 않습니다
        const by = pressedWith.current
        pressedWith.current = ''
        setOpen((was) => canHover(by) || !was)
      }}
      className={cn(
        'text-surface/95 rounded-card px-1',
        'hover:bg-surface/10 hover:text-surface aria-expanded:bg-surface/10 transition-colors duration-120 ease-out',
        'focus-visible:ring-dusk-gold outline-none focus-visible:ring-1',
        triggerClassName,
      )}
    >
      …
    </button>
  ) : null

  return (
    <div
      ref={rootRef}
      onPointerEnter={(event) => {
        if (canHover(event.pointerType)) setLeaving(false)
      }}
      onPointerLeave={(event) => {
        if (open && canHover(event.pointerType)) setLeaving(true)
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false)
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Escape' || !open) return
        setOpen(false)
        triggerRef.current?.focus()
      }}
    >
      {children(trigger)}
      {open && (
        <div
          ref={cardRef}
          id={cardId}
          className={cn(
            'absolute left-full z-10 ml-2.5 max-h-80 w-max max-w-60 overflow-y-auto',
            'border-surface/15 bg-dusk/85 rounded-glass shadow-glass border px-3.75 py-2.5',
            'text-caption text-surface/95 break-keep',
            'transition-opacity duration-120 ease-out starting:opacity-0',
          )}
        >
          {more}
        </div>
      )}
    </div>
  )
}
