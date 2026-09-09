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
 * 한 줄 세그먼트 필터 (와이어프레임 A33 — 진열대 기준 / 성별 두 줄)
 *
 * 와이어프레임 주석 그대로입니다.
 * - 두 줄을 겹쳐 걸 수 있다 → 줄마다 이 컴포넌트를 하나씩 두고 상태를 따로 관리합니다
 * - 아무 필터도 고르지 않은 상태가 기본 → value 는 null 로 시작하고,
 *   선택된 것을 다시 누르면 해제됩니다
 *
 * ⚠️ 한 줄 안에서 여러 개를 동시에 고를 수 있는지는 와이어프레임에 없습니다.
 * 지금은 한 줄에 하나만 고르는 것으로 두었습니다. 팀 확정 후 바꿔주세요.
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
              'flex-1 py-2.5 text-center text-xs transition-colors',
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
