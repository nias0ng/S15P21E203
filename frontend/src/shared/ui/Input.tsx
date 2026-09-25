import { useId } from 'react'

import { cn } from '@/shared/lib/cn'

type InputProps = Omit<React.ComponentPropsWithRef<'input'>, 'id'> & {
  label: string
  hideLabel?: boolean
  error?: string
  hint?: string
}

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
        aria-describedby={
          cn(hint && !error && hintId, error && errorId) || undefined
        }
        className={cn(
          'rounded-card text-body h-10 w-full border px-2.5',
          'placeholder:text-ink-muted/70',
          'bg-surface-card',

          // NOTE: 포커스 링을 일부러 안 답니다. 자리를 알리는 것은 입력 커서뿐입니다
          'outline-none',
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
