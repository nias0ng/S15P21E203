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
 * 칩 토글 (A11 진열대 분류 · 계절 등록, A13 분류 변경, A15). 칩이 낱개로 떨어져
 * 있고 여러 개를 고를 수 있습니다 — 진열대 분류(SHF-01)는 하나만, 계절(DTL-16 ·
 * 24)은 여러 개입니다.
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
              /*
                고른 칩은 `ink` 한 가지입니다. 예전에는 `warm` 톤이 따로 있었는데
                그 색(`accent-warm`)이 `@theme` 에 없어 칩이 통째로 사라졌습니다
                (S15P21E203-370). 밝은 화면에서는 짙은 칩, 유리판 위에서는 하얀
                칩입니다.

                흰색/베이지를 여기서 가르지 않습니다 — `selected` 토큰이 방마다
                다른 값을 들고 옵니다(`styles/scent-display.css`).
              */
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
