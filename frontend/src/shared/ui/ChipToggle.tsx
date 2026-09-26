import { cn } from '@/shared/lib/cn'

type Option<T extends string> = { value: T; label: string }

type ChipToggleProps<T extends string> = {
  label: string
  options: readonly Option<T>[]
  className?: string
} & (
  | {
      multiple?: false
      value: T | null
      onChange: (next: T | null) => void
    }
  | {
      multiple: true
      value: readonly T[]
      onChange: (next: T[]) => void
    }
)

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
      className={cn('flex flex-wrap gap-2.5', className)}
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
              'border-line text-caption rounded-card border px-2.5 py-2.5',
              'transition-colors duration-120 ease-out',
              'focus-visible:ring-accent-deep outline-none focus-visible:ring-2',
              selected
                ? 'bg-selected text-surface'
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
