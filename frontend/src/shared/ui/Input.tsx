import { useId } from 'react'

import { cn } from '@/shared/lib/cn'

type InputProps = Omit<React.ComponentPropsWithRef<'input'>, 'id'> & {
  /** 화면에 보이는 라벨. 접근성상 필수라 optional 로 두지 않았습니다. */
  label: string
  /** 라벨을 시각적으로 숨깁니다(검색창처럼 placeholder 로 충분한 경우). 읽어주기는 유지됩니다. */
  hideLabel?: boolean
  /** 에러 메시지. 값이 있으면 테두리가 빨개지고 메시지가 아래에 붙습니다. */
  error?: string
  /** 입력 형식 안내 같은 보조 설명 */
  hint?: string
}

/**
 * 라벨·에러·설명을 한 덩어리로 묶은 입력창.
 * id 연결 · aria-invalid · aria-describedby 를 컴포넌트가 맡습니다.
 */
export function Input({
  label,
  hideLabel = false,
  error,
  hint,
  className,
  ...props
}: InputProps) {
  const id = useId()
  const errorId = `${id}-error`
  const hintId = `${id}-hint`

  return (
    <div className="space-y-2.5">
      <label
        htmlFor={id}
        className={cn(
          'text-caption block font-medium',
          hideLabel && 'sr-only', // 화면에서만 숨기고 스크린리더는 읽습니다
        )}
      >
        {label}
      </label>

      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={cn(hint && hintId, error && errorId) || undefined}
        className={cn(
          'rounded-card text-body h-10 w-full border px-2.5',
          'placeholder:text-ink-muted/70',
          // 바탕을 한 단 밝게 칠합니다 — 비워 두면 테두리 한 줄로만 칸을 알려야 합니다
          'bg-surface-card',

          'focus-visible:ring-accent-deep outline-none focus-visible:ring-2',
          'disabled:bg-line-soft disabled:opacity-60',
          error ? 'border-danger' : 'border-line',
          className,
        )}
        {...props}
      />

      {hint && !error && (
        <p id={hintId} className="text-ink-muted text-caption">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-danger text-caption">
          {error}
        </p>
      )}
    </div>
  )
}
