import { useRef } from 'react'

import { cn } from '@/shared/lib/cn'

import type { ShelfItem } from '../types'

type Props = {
  title: string
  items: ShelfItem[]
  selectedId: number | null
  onSelect: (item: ShelfItem) => void
}

/**
 * 진열대 한 칸 (와이어프레임 A13)
 *
 * 향수를 선반 위에 세워둔 모양입니다. 병 높이를 조금씩 다르게 해서 실제 진열대처럼
 * 보이게 하고, 아래 선에 맞춰 세웁니다.
 *
 * 와이어프레임 주석: "한 칸에 다 안 들어가면 [▶]로 다음 향수를 밀어 본다 (가로 스크롤)".
 * 그래서 넘치면 가로 스크롤이고 [▶]가 스크롤을 밀어줍니다.
 */
export function ShelfRow({ title, items, selectedId, onSelect }: Props) {
  const trackRef = useRef<HTMLUListElement>(null)

  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        <h3 className="text-ink text-xs font-bold">{title}</h3>
        <span className="text-ink-muted text-[10.5px]">{items.length}개</span>

        <button
          type="button"
          aria-label={`${title} 다음 향수 보기`}
          onClick={() =>
            trackRef.current?.scrollBy({ left: 240, behavior: 'smooth' })
          }
          className="border-line text-ink hover:bg-line-soft ml-auto border px-2 py-1 text-[11px]"
        >
          <span aria-hidden>▶</span>
        </button>
      </div>

      {/* 선반 — 아래 선에 병을 세웁니다 */}
      <ul
        ref={trackRef}
        className="border-ink flex items-end gap-3 overflow-x-auto border-b-2 pb-0"
      >
        {items.map((item, index) => (
          <li key={item.shelfItemId} className="relative shrink-0 pt-6">
            {/* 대표 향수는 한 번에 하나 · 보유 중 칸에만 표시됩니다 */}
            {item.representative && (
              <span className="border-line bg-surface-card text-ink absolute top-0 left-1/2 -translate-x-1/2 border px-2 py-0.5 text-[10px] whitespace-nowrap">
                대표
              </span>
            )}
            <button
              type="button"
              aria-pressed={selectedId === item.shelfItemId}
              onClick={() => onSelect(item)}
              title={`${item.name} · ${item.brand}`}
              className={cn(
                'border-line block w-14 border border-b-0 transition-colors',
                // 병처럼 보이도록 높이를 번갈아 다르게 줍니다
                BOTTLE_HEIGHTS[index % BOTTLE_HEIGHTS.length],
                selectedId === item.shelfItemId
                  ? 'bg-fog border-ink'
                  : 'bg-surface-sunken hover:bg-fog',
              )}
            >
              <span className="sr-only">
                {item.name} {item.brand}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

const BOTTLE_HEIGHTS = ['h-24', 'h-28', 'h-20', 'h-26', 'h-22', 'h-30'] as const
