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
 * 줄마다 하나씩 두고 상태를 따로 관리합니다. `value` 는 null 로 시작하고 선택된 것을
 * 다시 누르면 해제됩니다.
 *
 * ⚠️ 한 줄에서 여러 개를 고를 수 있는지는 와이어프레임에 없습니다. 팀 확정 후 바꿔주세요.
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
      className={cn(
        'border-line/60 bg-surface-veil rounded-panel flex border p-1',
        className,
      )}
    >
      {options.map((option) => {
        const selected = value === option.value

        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(selected ? null : option.value)}
            className={cn(
              'text-body rounded-card flex-1 py-2.5 text-center',
              'transition-colors duration-120 ease-out',
              // 칸 사이 세로줄 없음 — 색 면 옆에 줄이 있으면 이가 빠져 보입니다
              selected
                ? 'bg-accent-warm text-surface-card'
                : 'text-ink hover:bg-line-soft/60 bg-transparent',
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
