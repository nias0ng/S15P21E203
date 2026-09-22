import { cn } from '@/shared/lib/cn'

import { familyAriaLabel, scentFamilyLabel } from '../families'
import type { ScentFamilyKey } from '../types'

type FamilyTileProps = {
  family: ScentFamilyKey
  selected: boolean
  /** 두 개를 이미 골랐고 이 타일은 그중 하나가 아닐 때 — 불이 꺼집니다 */
  dimmed: boolean
  /** 고른 순서. 1이 1순위이고 가중치를 더 받습니다 */
  order?: number
  onToggle: (family: ScentFamilyKey) => void
}

/** 향 계열 타일 (TST-03). 낱말이 바뀌는 것은 눈으로만 알 수 있어 `aria-label` 에 둘을 함께 읽힙니다. */
export function FamilyTile({
  family,
  selected,
  dimmed,
  order,
  onToggle,
}: FamilyTileProps) {
  const { adjective, name } = scentFamilyLabel(family)

  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={familyAriaLabel(family)}
      disabled={dimmed}
      onClick={() => onToggle(family)}
      className={cn(
        'group rounded-card flex h-18 items-center justify-between gap-2 border px-4',
        'transition-colors duration-120 ease-out',
        'focus-visible:ring-accent-deep outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        // 비활성은 테두리만 남깁니다 — 채움을 없애면 "누를 수 없다"가 형태로 드러납니다
        'disabled:border-line disabled:pointer-events-none disabled:bg-transparent disabled:opacity-30',
        selected
          ? 'border-ink bg-ink text-surface'
          : 'border-line bg-surface-card text-ink hover:border-accent-deep hover:bg-line-soft',
      )}
    >
      <span className="text-heading font-serif font-semibold">
        {selected ? (
          // 고른 뒤에는 계열명으로 고정 — 마우스가 지나갈 때마다 글자가 바뀌지 않습니다
          name
        ) : (
          <>
            <span className="group-hover:hidden group-focus-visible:hidden">
              {adjective}
            </span>
            <span className="text-accent-deep hidden group-hover:inline group-focus-visible:inline">
              {name}
            </span>
          </>
        )}
      </span>

      {order && (
        <span className="text-caption border-surface/50 text-surface shrink-0 rounded-full border px-2">
          {order}순위
        </span>
      )}
    </button>
  )
}
