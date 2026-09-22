import { useId, useState } from 'react'

import { cn } from '@/shared/lib/cn'

/** 국내에서 쓰는 여섯 개만 둡니다 — 길어지면 고르는 게 직접 적는 것보다 느립니다 */
const EMAIL_DOMAINS = [
  'naver.com',
  'gmail.com',
  'daum.net',
  'hanmail.net',
  'nate.com',
  'kakao.com',
] as const

const DIRECT = 'direct'

/** `Input` 을 그대로 쓰면 한 줄에 붙은 칸 셋마다 라벨 · 에러가 따로 생깁니다 */
const CONTROL = cn(
  'rounded-card text-body bg-surface-card h-10 w-full border px-2.5',
  'placeholder:text-ink-muted/70',
  'focus-visible:ring-accent-deep outline-none focus-visible:ring-2',
)

type Props = {
  onChange: (email: string) => void
  error?: string
  hint?: string
}

/**
 * 회원가입 이메일 칸. 아이디와 도메인을 따로 받고, 다 갖춰졌을 때만 주소를
 * 알립니다 — 반쪽짜리(`hyanghae@`)를 넘기면 가입 화면이 [가입하기] 를 켭니다.
 */
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
          // `username` 을 걸면 비밀번호 관리자가 아이디만 계정명으로 저장해, 전체 주소를 적는 로그인과 어긋납니다
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
          /*
           * 바닥(`min-w`)이 있는 이유 — 칸은 `--spacing` 을 타 1536 에서 80% 로 줄지만
           * 도메인 글자는 13px 그대로입니다. 바닥이 없으면 가장 긴 `hanmail.net` 을 비롯해
           * 여섯 중 넷이 네이티브 화살표에 잘립니다. 11 글자 + 화살표 + 좌우 여백이라
           * `16ch` 이고, 1920 에서는 칸이 더 넓어 바닥이 무시됩니다.
           */
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
