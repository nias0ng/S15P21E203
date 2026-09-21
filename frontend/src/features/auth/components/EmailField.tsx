import { useId, useState } from 'react'

import { cn } from '@/shared/lib/cn'

/**
 * 고를 수 있는 메일 도메인. 국내에서 쓰는 여섯 개만 둡니다 — 목록이 길어지면
 * 고르는 시간이 직접 적는 시간보다 오래 걸립니다. 나머지는 직접입력입니다.
 */
const EMAIL_DOMAINS = [
  'naver.com',
  'gmail.com',
  'daum.net',
  'hanmail.net',
  'nate.com',
  'kakao.com',
] as const

/** 목록에 없는 도메인을 직접 적겠다는 표시. 도메인 값과 섞이지 않는 값입니다 */
const DIRECT = 'direct'

/**
 * `shared/ui/Input` 과 같은 생김새. 이 칸은 입력창 · `@` · 고르는 칸이 한 줄로
 * 붙어 있어 `Input` 을 그대로 쓰면 라벨 · 에러가 세 벌 생깁니다.
 */
const CONTROL = cn(
  'rounded-card text-body bg-surface-card h-10 w-full border px-2.5',
  'placeholder:text-ink-muted/70',
  'focus-visible:ring-accent-deep outline-none focus-visible:ring-2',
)

type Props = {
  /** 아이디와 도메인이 다 갖춰지면 이어 붙인 주소, 아니면 빈 문자열 */
  onChange: (email: string) => void
  /** 값이 있으면 테두리가 빨개지고 메시지가 아래에 붙습니다 */
  error?: string
  /** 통과했을 때의 안내 같은 보조 설명 */
  hint?: string
}

/**
 * 회원가입 이메일 칸 (A28 — COM-01). **아이디와 도메인을 따로 받습니다** —
 * `@` 는 고정으로 찍어 두고, 도메인은 목록에서 고르거나 직접 적습니다.
 *
 * 바깥에는 **다 갖춰졌을 때만** 주소를 알립니다. 반쪽짜리(`hyanghae@`)를 넘기면
 * 회원가입 화면이 그걸 이메일로 알고 [중복 확인] 과 [가입하기] 를 켭니다.
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
          /*
            반쪽짜리 값이라 자동완성을 끕니다. `username` 을 걸면 비밀번호 관리자가
            아이디만(`hyanghae`) 계정명으로 저장해, 전체 주소를 적는 로그인과
            어긋납니다.
          */
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
          className={cn(CONTROL, borderClass, 'min-w-0 flex-1')}
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
