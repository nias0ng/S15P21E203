import { useId } from 'react'

import { cn } from '@/shared/lib/cn'

type TextareaProps = Omit<React.ComponentPropsWithRef<'textarea'>, 'id'> & {
  label: string
  hideLabel?: boolean
  error?: string
}

export function Textarea({
  label,
  hideLabel = false,
  error,
  className,
  ...props
}: TextareaProps) {
  const id = useId()
  const errorId = `${id}-error`

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

      <textarea
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={cn(
          'rounded-card text-body w-full border px-2.5 py-2.5',
          'placeholder:text-ink-muted/70',
          'bg-surface-card',

          'resize-none',
          // NOTE: 포커스 링을 일부러 안 답니다. 자리를 알리는 것은 입력 커서뿐입니다 (`Input` 과 같습니다)
          'outline-none',
          'disabled:bg-line-soft disabled:opacity-60',
          error ? 'border-danger' : 'border-line',
          className,
        )}
        {...props}
      />

      {error && (
        <p id={errorId} className="text-danger text-caption">
          {error}
        </p>
      )}
    </div>
  )
}
