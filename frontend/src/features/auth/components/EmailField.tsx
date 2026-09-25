import { useId, useState } from 'react'

import { cn } from '@/shared/lib/cn'

const EMAIL_DOMAINS = [
  'naver.com',
  'gmail.com',
  'daum.net',
  'hanmail.net',
  'nate.com',
  'kakao.com',
] as const

const DIRECT = 'direct'

const CONTROL = cn(
  'rounded-card text-body bg-surface-card h-10 w-full border px-2.5',
  'placeholder:text-ink-muted/70',
  // NOTE: 포커스 링을 일부러 안 답니다. 자리를 알리는 것은 입력 커서뿐입니다 (`Input` 과 같습니다)
  'outline-none',
)

type Props = {
  onChange: (email: string) => void
  error?: string
  hint?: string
}

export function EmailField({ onChange, error, hint }: Props) {
  const [local, setLocal] = useState('')
  const [choice, setChoice] = useState('')
  const [custom, setCustom] = useState('')

  const localId = useId()
  const choiceId = useId()
  const customId = useId()
  const errorId = `${localId}-error`
  const hintId = `${localId}-hint`

  const describedBy =
    cn(hint && !error && hintId, error && errorId) || undefined
  const borderClass = error ? 'border-danger' : 'border-line'

  const report = (
    nextLocal: string,
    nextChoice: string,
    nextCustom: string,
  ) => {
    const domain = nextChoice === DIRECT ? nextCustom : nextChoice
    onChange(nextLocal && domain ? `${nextLocal}@${domain}` : '')
  }

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-1.25">
        <label htmlFor={localId} className="sr-only">
          이메일 아이디
        </label>
        <input
          id={localId}
          className={cn(CONTROL, borderClass, 'min-w-0 flex-1')}
          placeholder="이메일"
          autoComplete="off"
          required
          value={local}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          onChange={(event) => {
            setLocal(event.target.value)
            report(event.target.value, choice, custom)
          }}
        />

        <span aria-hidden className="text-ink text-body shrink-0">
          @
        </span>

        <label htmlFor={choiceId} className="sr-only">
          이메일 도메인
        </label>
        <select
          id={choiceId}
          className={cn(CONTROL, borderClass, 'min-w-[16ch] flex-1')}
          value={choice}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          onChange={(event) => {
            setChoice(event.target.value)
            report(local, event.target.value, custom)
          }}
        >
          <option value="">선택</option>
          {EMAIL_DOMAINS.map((entry) => (
            <option key={entry} value={entry}>
              {entry}
            </option>
          ))}
          <option value={DIRECT}>직접입력</option>
        </select>
      </div>

      {choice === DIRECT && (
        <>
          <label htmlFor={customId} className="sr-only">
            도메인 직접 입력
          </label>
          <input
            id={customId}
            className={cn(CONTROL, borderClass)}
            placeholder="도메인을 입력하세요 (예: ssafy.com)"
            required
            value={custom}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            onChange={(event) => {
              setCustom(event.target.value)
              report(local, choice, event.target.value)
            }}
          />
        </>
      )}

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
