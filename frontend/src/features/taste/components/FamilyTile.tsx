import { cn } from '@/shared/lib/cn'
import { FOCUS_RING } from '@/shared/ui/focusRing'

import { familyAriaLabel, scentFamilyLabel } from '../families'
import type { ScentFamilyKey } from '../types'

type FamilyTileProps = {
  family: ScentFamilyKey
  selected: boolean
  dimmed: boolean
  order?: number
  onToggle: (family: ScentFamilyKey) => void
}

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
        'group rounded-card relative flex h-18 items-center border px-4',
        'justify-between gap-2 md:justify-center md:gap-0',
        'transition-colors duration-120 ease-out',
        FOCUS_RING,
        'disabled:border-line disabled:pointer-events-none disabled:bg-transparent disabled:opacity-30',
        selected
          ? 'border-ink bg-ink text-surface'
          : 'border-line bg-surface-card text-ink hover:border-sunset',
      )}
    >
      <span className="text-heading md:text-title font-serif font-semibold">
        {selected ? (
          name
        ) : (
          <>
            <span className="group-hover:hidden group-focus-visible:hidden">
              {adjective}
            </span>
            <span className="text-sunset hidden group-hover:inline group-focus-visible:inline">
              {name}
            </span>
          </>
        )}
      </span>

      {order && (
        <span className="text-caption border-surface/50 text-surface shrink-0 rounded-full border px-2 md:absolute md:top-1/2 md:right-4 md:-translate-y-1/2">
          {order}순위
        </span>
      )}
    </button>
  )
}
