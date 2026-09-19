import { MAX_PICKS, SCENT_FAMILIES } from '../families'
import type { ScentFamilyKey } from '../types'

import { FamilyTile } from './FamilyTile'

type FamilyPickerProps = {
  /** 고른 계열. `[0]` 이 1순위입니다 */
  value: readonly ScentFamilyKey[]
  onChange: (next: ScentFamilyKey[]) => void
}

/**
 * 향 계열 고르기 (TST-03). 최대 2개이고 두 개를 고르면 나머지 타일은 꺼집니다.
 * **고른 순서가 그대로 1순위 · 2순위**입니다.
 */
export function FamilyPicker({ value, onChange }: FamilyPickerProps) {
  const full = value.length >= MAX_PICKS

  const toggle = (family: ScentFamilyKey) => {
    if (value.includes(family)) {
      onChange(value.filter((picked) => picked !== family))
      return
    }
    if (full) return
    onChange([...value, family])
  }

  return (
    <div
      role="group"
      aria-label="향 계열 고르기"
      className="grid grid-cols-2 gap-4 sm:grid-cols-3"
    >
      {SCENT_FAMILIES.map(({ key }) => {
        const index = value.indexOf(key)
        const selected = index >= 0

        return (
          <FamilyTile
            key={key}
            family={key}
            selected={selected}
            dimmed={full && !selected}
            order={selected ? index + 1 : undefined}
            onToggle={toggle}
          />
        )
      })}
    </div>
  )
}
