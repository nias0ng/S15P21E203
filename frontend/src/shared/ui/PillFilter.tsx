import { cn } from '@/shared/lib/cn'

type PillFilterProps<T extends string> = {
  /** 낭독기가 읽을 묶음 이름. 한 화면에 알약 묶음이 둘이면 구분이 필요합니다 */
  label: string
  options: readonly { value: T; label: string }[]
  /** 고른 것. 아무것도 안 골랐으면 null */
  value: T | null
  /**
   * 고른 것이 바뀌었을 때. **켜진 것을 다시 누르면 `null` 이 옵니다**(해제).
   * `required` 면 `null` 은 오지 않습니다.
   */
  onChange: (next: T | null) => void
  /**
   * 늘 하나가 켜져 있어야 하는 묶음인지. 정렬처럼 "고르지 않음" 이 없는 것에
   * 씁니다 — 성별 · 인기 필터는 해제가 있어야 해서 기본값이 `false` 입니다.
   */
  required?: boolean
  className?: string
}

/**
 * 어둠 위에 놓이는 알약 필터 (A33 향수 · A34 브랜드)
 *
 * 생김새는 `styles/scent-display.css` 의 `.scent-pill` 이 그립니다 — **어두운
 * 방(`.scent-night`) 안에서만 제 모양이 납니다.** 고르는 방식은 `ChipToggle` 과
 * 같지만 저쪽은 밝은 화면용입니다.
 */
export function PillFilter<T extends string>({
  label,
  options,
  value,
  onChange,
  required = false,
  className,
}: PillFilterProps<T>) {
  return (
    // 눌린 상태를 aria-pressed 로 알리므로 group 으로 묶어 이름을 붙입니다
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
              // 늘 하나가 켜져 있어야 하는 묶음은 다시 눌러도 안 꺼집니다
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
