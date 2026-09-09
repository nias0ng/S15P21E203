import { useCallback, useEffect, useRef, useState } from 'react'

import { cn } from '@/shared/lib/cn'

import type { ShelfItem } from '../types'

type Props = {
  title: string
  items: ShelfItem[]
  selectedId: number | null
  onSelect: (item: ShelfItem) => void
}

/** 화살표 한 번에 밀어 보낼 병 개수 */
const STEP = 3

/**
 * 진열대 한 칸 (와이어프레임 A13)
 *
 * 향수를 선반 위에 세워둔 모양입니다. 아래 선에 병 바닥을 맞춰 세웁니다.
 * 칸 크기는 전부 같고(h-28 w-16), 병이 달라 보이는 것은 사진의 가로세로 비율
 * 때문입니다. object-contain 이라 비율이 찌그러지지 않습니다.
 *
 * 병 이미지는 **배경이 투명한 PNG** 로 들어옵니다. 그래서 이미지 칸에 테두리나
 * 배경을 주지 않습니다 — 주면 투명 영역이 네모로 드러나 병이 상자에 든 것처럼
 * 보입니다. 이미지가 없는 향수는 병 실루엣을 대신 그립니다.
 *
 * 와이어프레임 주석: "한 칸에 다 안 들어가면 다음 향수를 밀어 본다 (가로 스크롤)".
 * 넘칠 때만 화살표가 나타나고, 화살표 뒤의 병이 비쳐 보이게 두었습니다.
 * 가려버리면 "더 있다" 는 것이 화살표에만 의존하는데, 흐릿하게 이어지면
 * 화살표를 보기 전에 이미 읽힙니다.
 */
export function ShelfRow({ title, items, selectedId, onSelect }: Props) {
  const trackRef = useRef<HTMLUListElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const sync = useCallback(() => {
    const el = trackRef.current
    if (!el) return
    // 소수점 오차로 끝에서 1px 이 남는 브라우저가 있어 여유를 둡니다
    setCanScrollLeft(el.scrollLeft > 1)
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1)
  }, [])

  useEffect(() => {
    const el = trackRef.current
    if (!el) return

    sync()
    el.addEventListener('scroll', sync, { passive: true })

    // 창 크기가 바뀌면 넘침 여부도 바뀝니다
    const observer = new ResizeObserver(sync)
    observer.observe(el)

    return () => {
      el.removeEventListener('scroll', sync)
      observer.disconnect()
    }
  }, [sync, items.length])

  const scrollByStep = (direction: 1 | -1) => {
    const el = trackRef.current
    if (!el) return
    // 병 하나 폭을 실제 요소에서 잽니다. 고정값을 쓰면 병 크기를 바꿀 때
    // 여기도 같이 고쳐야 하고, 잊으면 조용히 어긋납니다.
    const first = el.querySelector('li')
    const step = first ? first.getBoundingClientRect().width + 12 : 68
    el.scrollBy({ left: direction * step * STEP, behavior: 'smooth' })
  }

  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        <h3 className="text-ink text-heading font-serif font-semibold">
          {title}
        </h3>
        <span className="text-ink-muted text-caption">{items.length}개</span>
      </div>

      {/* 선반 — 아래 선에 병을 세웁니다 */}
      <div className="relative">
        {/*
          overflow-x-hidden 이라 스크롤바가 없고 손으로도 밀리지 않습니다.
          다만 스크립트로는 여전히 밀 수 있어서(scrollBy) 화살표만 동작합니다.
          키보드로 화면 밖 병에 탭 이동하면 브라우저가 알아서 그 위치로 옮겨줍니다.
        */}
        <ul
          ref={trackRef}
          className="border-ink flex items-end gap-3 overflow-x-hidden border-b-2"
        >
          {items.map((item) => (
            <li key={item.shelfItemId} className="relative shrink-0 pt-6">
              {/* 대표 향수는 한 번에 하나 · 보유 중 칸에만 표시됩니다 */}
              {item.representative && (
                <span className="border-line bg-surface-card text-ink text-caption absolute top-0 left-1/2 -translate-x-1/2 border px-2 py-1 whitespace-nowrap">
                  대표
                </span>
              )}
              <button
                type="button"
                aria-pressed={selectedId === item.shelfItemId}
                onClick={() => onSelect(item)}
                title={`${item.name} · ${item.brand}`}
                className={cn(
                  // 칸 크기는 전부 같습니다. 병마다 달라 보이는 것은 사진 자체의
                  // 가로세로 비율이지, 칸이 다른 것이 아닙니다.
                  'block h-28 w-16 transition-opacity duration-120 ease-out',
                  'focus-visible:ring-accent-deep rounded-card outline-none focus-visible:ring-2',
                  selectedId === item.shelfItemId
                    ? 'opacity-100'
                    : 'opacity-80 hover:opacity-100',
                )}
              >
                {item.thumbnailUrl ? (
                  <img
                    src={item.thumbnailUrl}
                    alt=""
                    className="size-full object-contain object-bottom"
                  />
                ) : (
                  <BottleSilhouette
                    selected={selectedId === item.shelfItemId}
                  />
                )}
                <span className="sr-only">
                  {item.name} {item.brand}
                </span>
              </button>
            </li>
          ))}
        </ul>

        {canScrollLeft && (
          <ScrollArrow
            direction="left"
            title={title}
            onClick={() => scrollByStep(-1)}
          />
        )}
        {canScrollRight && (
          <ScrollArrow
            direction="right"
            title={title}
            onClick={() => scrollByStep(1)}
          />
        )}
      </div>
    </section>
  )
}

/**
 * 선반 가장자리에 겹쳐 두는 화살표.
 *
 * 배경을 반투명 그러데이션으로 두어 뒤의 병이 비쳐 보입니다.
 * 화살표 자체는 진하지 않게(`text-ink-muted`) 두어 병보다 앞으로 나오지 않게 합니다.
 */
function ScrollArrow({
  direction,
  title,
  onClick,
}: {
  direction: 'left' | 'right'
  title: string
  onClick: () => void
}) {
  const isRight = direction === 'right'

  return (
    <button
      type="button"
      aria-label={`${title} ${isRight ? '다음' : '이전'} 향수 보기`}
      onClick={onClick}
      className={cn(
        'absolute top-0 bottom-1 flex w-12 items-start justify-center pt-8',
        'text-ink-muted hover:text-ink transition-colors duration-120 ease-out',
        'focus-visible:ring-accent-deep rounded-card outline-none focus-visible:ring-2',
        isRight
          ? 'from-surface/85 via-surface/45 right-0 bg-gradient-to-l to-transparent'
          : 'from-surface/85 via-surface/45 left-0 bg-gradient-to-r to-transparent',
      )}
    >
      {/*
        병 어깨선에 맞춰 7px 내립니다. 간격 스케일(4의 배수)을 벗어나는 값인데,
        레이아웃 간격이 아니라 글리프 하나의 시각 보정이라 예외로 둡니다.
        문자 '›' 자체가 위쪽으로 치우쳐 있어 스케일 값으로는 안 맞습니다.
      */}
      <span aria-hidden className="text-title mt-[7px] leading-none">
        {isRight ? '›' : '‹'}
      </span>
    </button>
  )
}

/** 이미지가 없는 향수 자리. 배경 투명 PNG 가 들어오면 이 자리가 그 이미지가 됩니다. */
function BottleSilhouette({ selected }: { selected: boolean }) {
  return (
    <svg
      viewBox="0 0 32 64"
      className={cn('size-full', selected ? 'text-line' : 'text-line-soft')}
      aria-hidden
    >
      {/* 목 · 어깨 · 몸통을 한 덩어리로 그립니다 */}
      <path
        fill="currentColor"
        d="M13 2h6v7c0 2 6 4 6 9v44a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V18c0-5 6-7 6-9V2Z"
      />
    </svg>
  )
}
