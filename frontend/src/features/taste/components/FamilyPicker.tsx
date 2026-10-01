import { useTranslation } from 'react-i18next'

import { MAX_PICKS } from '../families'
import { SCENT_FAMILY_KEYS, type ScentFamilyKey } from '../types'

import { FamilyTile } from './FamilyTile'

type FamilyPickerProps = {
  value: readonly ScentFamilyKey[]
  onChange: (next: ScentFamilyKey[]) => void
}

export function FamilyPicker({ value, onChange }: FamilyPickerProps) {
  // 언어를 바꾸면 타일도 다시 그려 그 언어의 이름을 읽습니다
  const { t } = useTranslation('taste')
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
      aria-label={t('picker.label')}
      className="grid grid-cols-2 gap-4 sm:grid-cols-3"
    >
      {SCENT_FAMILY_KEYS.map((key) => {
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
