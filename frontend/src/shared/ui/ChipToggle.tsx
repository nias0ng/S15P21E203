import { cn } from '@/shared/lib/cn'

type Option<T extends string> = { value: T; label: string }

type ChipToggleProps<T extends string> = {
  /** 무엇을 고르는 것인지 (화면에 보이지 않습니다) */
  label: string
  options: readonly Option<T>[]
  className?: string
} & (
  | {
      /** 하나만 고르는 모드. 같은 것을 다시 누르면 해제됩니다. */
      multiple?: false
      value: T | null
      onChange: (next: T | null) => void
    }
  | {
      /** 여러 개를 고르는 모드 */
      multiple: true
      value: readonly T[]
      onChange: (next: T[]) => void
    }
)

/**
 * 칩 토글 (와이어프레임 A11 진열대 분류 · 계절 등록, A13 분류 변경, A15)
 *
 * SegmentedFilter 와 달리 칩이 낱개로 떨어져 있고, 여러 개를 고를 수 있습니다.
 * - 진열대 분류(SHF-01)는 하나만 — "분류는 필수. 선택하지 않으면 저장하지 않는다"
 * - 계절(DTL-16 · DTL-24)은 여러 개 — "기존에 선택한 계절을 추가하거나 해제"
 */
export function ChipToggle<T extends string>(props: ChipToggleProps<T>) {
  const { label, options, className } = props

  const isSelected = (value: T) =>
    props.multiple ? props.value.includes(value) : props.value === value

  const toggle = (value: T) => {
    if (props.multiple) {
      props.onChange(
        props.value.includes(value)
          ? props.value.filter((item) => item !== value)
          : [...props.value, value],
      )
      return
    }
    props.onChange(props.value === value ? null : value)
  }

  return (
    <div
      role="group"
      aria-label={label}
      className={cn('flex flex-wrap gap-1.5', className)}
    >
      {options.map((option) => {
        const selected = isSelected(option.value)

        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            onClick={() => toggle(option.value)}
            className={cn(
              'border-line border px-3 py-2 text-[11px] transition-colors',
              'focus-visible:ring-accent-deep outline-none focus-visible:ring-2',
              selected
                ? 'bg-ink text-surface'
                : 'text-ink hover:bg-line-soft bg-surface-card',
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
