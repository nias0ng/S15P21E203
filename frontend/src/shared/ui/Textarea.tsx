import { useId } from 'react'

import { cn } from '@/shared/lib/cn'

type TextareaProps = Omit<React.ComponentPropsWithRef<'textarea'>, 'id'> & {
  /** 화면에 보이는 라벨. 접근성상 필수라 optional 로 두지 않았습니다. */
  label: string
  /** 라벨을 시각적으로 숨깁니다(placeholder 로 충분한 경우). 읽어주기는 유지됩니다. */
  hideLabel?: boolean
  /** 에러 메시지. 값이 있으면 테두리가 빨개지고 메시지가 아래에 붙습니다. */
  error?: string
}

/**
 * 여러 줄 입력창. {@link Input} 의 textarea 판입니다 — id 연결 · aria-invalid ·
 * aria-describedby 를 맡고, 겉모습도 Input 과 같습니다. 바깥 여백 · flex 배치는
 * 감싸는 쪽에서 합니다(래퍼 className 을 받지 않습니다).
 */
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
          /* 바탕을 칠하지 않으면 페이지 바탕이 비쳐 테두리 한 줄로만 구분됩니다 */
          'bg-surface-card',

          /*
           * 브라우저 기본값(resize: both)의 손잡이를 끌면 옆 단추와 겹치거나 칸이
           * 화면 밖으로 나갑니다. 늘어나야 하면 부르는 쪽이 `resize-y` 로 되돌립니다.
           */
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
