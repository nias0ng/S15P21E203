import { cn } from '@/shared/lib/cn'

type Option<T extends string> = { value: T; label: string }

type SegmentedFilterProps<T extends string> = {
  /** 이 줄이 무엇을 고르는 것인지 (화면에는 보이지 않습니다) */
  label: string
  options: readonly Option<T>[]
  /** 선택된 값. null 이면 아무것도 고르지 않은 상태 */
  value: T | null
  /** 같은 값을 다시 누르면 null 이 넘어옵니다 (필터 해제) */
  onChange: (next: T | null) => void
  className?: string
}

/**
 * 한 줄 세그먼트 필터 (A33). 두 줄을 겹쳐 걸 수 있어 줄마다 하나씩 두고, 고른 것을
 * 다시 누르면 해제됩니다. ⚠️ 한 줄 안에서 여러 개는 팀 확정 전입니다.
 */
export function SegmentedFilter<T extends string>({
  label,
  options,
  value,
  onChange,
  className,
}: SegmentedFilterProps<T>) {
  return (
    <div
      // 눌린 상태를 aria-pressed 로 알려주므로 group 으로 묶어 이름을 붙입니다
      role="group"
      aria-label={label}
      className={cn('border-line flex border p-px', className)}
    >
      {options.map((option, index) => {
        const selected = value === option.value

        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(selected ? null : option.value)}
            className={cn(
              'text-body flex-1 py-2.5 text-center',
              'transition-colors duration-120 ease-out',
              index > 0 && 'border-line -ml-px border-l',
              selected
                ? 'bg-ink text-surface'
                : 'text-ink hover:bg-line-soft bg-transparent',
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
