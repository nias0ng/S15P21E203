import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'

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
  'outline-none',
)

type Props = {
  onChange: (email: string) => void
  error?: string
  hint?: string
}

export function EmailField({ onChange, error, hint }: Props) {
  const { t } = useTranslation('auth')
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
          {t('email.localLabel')}
        </label>
        <input
          id={localId}
          className={cn(CONTROL, borderClass, 'min-w-0 flex-1')}
          placeholder={t('email.label')}
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
          {t('email.domainLabel')}
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
          <option value="">{t('email.domainChoose')}</option>
          {EMAIL_DOMAINS.map((entry) => (
            <option key={entry} value={entry}>
              {entry}
            </option>
          ))}
          <option value={DIRECT}>{t('email.domainDirect')}</option>
        </select>
      </div>

      {choice === DIRECT && (
        <>
          <label htmlFor={customId} className="sr-only">
            {t('email.customLabel')}
          </label>
          <input
            id={customId}
            className={cn(CONTROL, borderClass)}
            placeholder={t('email.customPlaceholder')}
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
