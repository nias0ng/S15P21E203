import { cn } from '@/shared/lib/cn'

type PillFilterProps<T extends string> = {
  label: string
  options: readonly { value: T; label: string }[]
  value: T | null
  onChange: (next: T | null) => void
  required?: boolean
  className?: string
}

export function PillFilter<T extends string>({
  label,
  options,
  value,
  onChange,
  required = false,
  className,
}: PillFilterProps<T>) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn('flex items-center gap-2.5', className)}
    >
      {options.map((option) => {
        const selected = value === option.value

        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            onClick={() => {
              if (selected && required) return
              onChange(selected ? null : option.value)
            }}
            className={cn(
              'scent-pill text-caption rounded-full px-6.25 py-1.75',
              'text-ink transition-colors duration-120 ease-out',
              // NOTE: 포커스 링을 일부러 안 답니다. 글쇠로 옮겨 다닐 때 어느 알약에 와 있는지 보이지 않습니다
              'outline-none',
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
