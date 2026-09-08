import { useId } from 'react'

import { cn } from '@/shared/lib/cn'

type TextareaProps = Omit<React.ComponentPropsWithRef<'textarea'>, 'id'> & {
  /** 화면에 보이는 라벨. 접근성상 필수라 optional 로 두지 않았습니다. */
  label: string
  /** 라벨을 시각적으로 숨깁니다(placeholder 로 충분한 경우). 읽어주기는 유지됩니다. */
  hideLabel?: boolean
  /** 에러 메시지. 값이 있으면 테두리가 빨개지고 메시지가 아래에 붙습니다. */
  error?: string
  /** 입력 형식 안내 같은 보조 설명 */
  hint?: string
}

/**
 * 여러 줄 입력창. {@link Input} 의 textarea 판입니다.
 *
 * label 과 textarea 의 id 연결, aria-invalid, aria-describedby 를 컴포넌트가 맡습니다.
 * 이걸 만들기 전에는 6곳이 각자 `<label><span className="sr-only">` 로 처리하고 있었고,
 * 한 곳씩 빠뜨리기 쉬운 구조였습니다.
 *
 * 겉모습은 Input 과 다릅니다(text-xs · 모서리 각짐). 기존 6곳의 모양을 그대로 옮긴 것이라,
 * Input 과 시각적으로 통일하는 건 디자인 확정 후 이 파일의 기본 클래스만 고치면 됩니다.
 *
 * 바깥 여백·flex 배치가 필요하면 감싸는 쪽에서 합니다(`<div className="flex-1">`).
 * 래퍼에 className 을 받지 않는 것은 Input 과 같은 규칙입니다.
 */
export function Textarea({
  label,
  hideLabel = false,
  error,
  hint,
  className,
  ...props
}: TextareaProps) {
  const id = useId()
  const errorId = `${id}-error`
  const hintId = `${id}-hint`

  return (
    <div className="space-y-1.5">
      <label
        htmlFor={id}
        className={cn(
          'block text-sm font-medium',
          hideLabel && 'sr-only', // 화면에서만 숨기고 스크린리더는 읽습니다
        )}
      >
        {label}
      </label>

      <textarea
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={cn(hint && hintId, error && errorId) || undefined}
        className={cn(
          'text-ink w-full border p-2.5 text-xs',
          'placeholder:text-ink-muted',
          'focus-visible:ring-accent outline-none focus-visible:ring-2',
          'disabled:bg-line-soft disabled:opacity-60',
          error ? 'border-red-500' : 'border-line',
          className,
        )}
        {...props}
      />

      {hint && !error && (
        <p id={hintId} className="text-ink-muted text-xs">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  )
}
