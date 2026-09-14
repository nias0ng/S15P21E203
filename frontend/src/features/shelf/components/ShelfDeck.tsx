import { useEffect, useRef, type ReactNode } from 'react'

import { cn } from '@/shared/lib/cn'

type Props = {
  /** 지금 보이는 칸의 순서 */
  index: number
  onIndexChange: (next: number) => void
  /** 칸 하나씩. 순서가 index 와 같아야 합니다 */
  children: ReactNode[]
  className?: string
}

/**
 * 진열장 높이. 한 칸이 벽감 + 라벨 줄이고, 세 칸이 이 높이로 겹칩니다.
 *
 * 내용에 맡기지 않고 못 박는 이유: 미끄러지는 거리가 칸 높이의 배수라 칸마다 높이가
 * 다르면 두 번째 칸부터 어긋납니다. 라벨의 `h-9`(두 줄 고정)과 짝을 이루는 값입니다.
 */
const DECK_HEIGHT = 415

/**
 * 휠을 한 번 굴린 뒤 다음 칸으로 넘어가기까지 무시할 시간(ms).
 *
 * 트랙패드는 한 번 튕기면 관성으로 wheel 이벤트를 수십 개 보냅니다. 잠그지 않으면
 * 한 번 밀었는데 세 칸이 다 지나갑니다. 전환(450ms)보다 조금 길게 잡습니다.
 */
const WHEEL_LOCK_MS = 620

/**
 * 세 칸이 위아래로 미끄러지는 진열장 (A13 재디자인)
 *
 * 보유 중 · 시향해 봄 · 보유 희망이 한 자리에 겹쳐 있고, 휠을 굴리거나 칩을 누르면
 * 현재 칸이 위로 빠지면서 다음 칸이 올라옵니다.
 *
 * **첫 칸에서 위로, 마지막 칸에서 아래로 굴릴 때는 가로채지 않습니다** — 전부
 * 가로채면 이 화면에 들어온 사용자가 아래 내용으로 내려갈 방법이 없어집니다.
 * 이벤트를 onWheel 이 아니라 직접 다는 이유: React 는 wheel 을 passive 로 붙여서
 * preventDefault 가 통하지 않습니다.
 *
 * 휠은 보조 수단입니다. 칸을 고르는 정식 조작은 툴바의 칩이고 그쪽은 키보드로 닿습니다.
 */
export function ShelfDeck({
  index,
  onIndexChange,
  children,
  className,
}: Props) {
  const ref = useRef<HTMLDivElement>(null)
  /*
   * 잠금이 풀리는 시각. ref 인 이유는 **리스너보다 오래 살아야** 하기 때문입니다.
   * effect 안의 지역 변수로 두면 칸이 바뀌며 리스너가 다시 달리는 순간 0 으로
   * 되돌아가, 관성으로 들어오는 다음 이벤트가 곧바로 통과합니다.
   */
  const lockedUntil = useRef(0)
  const count = children.length

  useEffect(() => {
    const element = ref.current
    if (!element) return

    const onWheel = (event: WheelEvent) => {
      // 가로가 더 큰 몸짓은 넘깁니다 — 트랙패드 좌우 밀기입니다
      if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return

      const direction = event.deltaY > 0 ? 1 : -1
      const atEdge =
        (direction < 0 && index === 0) || (direction > 0 && index === count - 1)
      if (atEdge) return // 페이지 스크롤에 넘긴다

      event.preventDefault()

      const now = performance.now()
      if (now < lockedUntil.current) return
      lockedUntil.current = now + WHEEL_LOCK_MS
      onIndexChange(index + direction)
    }

    element.addEventListener('wheel', onWheel, { passive: false })
    return () => element.removeEventListener('wheel', onWheel)
  }, [index, count, onIndexChange])

  return (
    <div
      ref={ref}
      style={{ height: DECK_HEIGHT }}
      className={cn('relative overflow-hidden', className)}
    >
      {/*
        칸 전체를 한 덩어리로 밀어 올립니다. 칸마다 따로 움직이면 둘 사이가 벌어지거나
        겹치는 순간이 생깁니다. translate3d 는 합성 단계에서만 처리되게 하려는 것으로,
        translateY(%) 로 두면 매 프레임 레이아웃을 다시 재서 눈에 띄게 끊깁니다.
      */}
      <div
        className="absolute inset-x-0 top-0 transition-transform duration-[450ms] ease-[cubic-bezier(0.22,0.61,0.36,1)]"
        style={{ transform: `translate3d(0, ${-index * DECK_HEIGHT}px, 0)` }}
      >
        {children.map((section, at) => (
          <div
            // 칸은 고정 세 개이고 순서가 바뀌지 않아서 순서를 key 로 씁니다
            key={at}
            style={{ height: DECK_HEIGHT }}
            // 안 보이는 칸은 낭독기와 탭 이동에서 빼야 합니다. 그대로 두면
            // 화면에 없는 병 21개가 탭 순서에 남습니다.
            aria-hidden={at !== index}
            inert={at !== index}
          >
            {section}
          </div>
        ))}
      </div>
    </div>
  )
}
