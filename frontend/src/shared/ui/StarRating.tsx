import { cn } from '@/shared/lib/cn'

type StarRatingProps = {
  /** 무엇에 대한 점수인지 (화면에 보이지 않습니다) */
  label: string
  /** 1~5, 없으면 null */
  value: number | null
  /** 읽기 전용이면 넘기지 마세요 */
  onChange?: (next: number) => void
  max?: number
  className?: string
}

/**
 * 별점 (와이어프레임 A15 — 내 취향 적합도 · SHF-12 · DTL-18 · DTL-19)
 *
 * 라디오 그룹으로 만듭니다. div 로 흉내내면 키보드 화살표 이동과 스크린리더의
 * "5개 중 4번째" 안내를 잃습니다. 읽기 전용일 때는 그림과 글자만 남깁니다.
 */
export function StarRating({
  label,
  value,
  onChange,
  max = 5,
  className,
}: StarRatingProps) {
  const readOnly = !onChange

  if (readOnly) {
    return (
      <span className={cn('inline-flex items-center gap-1.25', className)}>
        <span aria-hidden className="text-ink text-body tracking-[0.15em]">
          {'★'.repeat(value ?? 0)}
          <span className="text-line">{'☆'.repeat(max - (value ?? 0))}</span>
        </span>
        <span className="text-ink-muted text-caption">
          {value ?? '-'} / {max}
        </span>
      </span>
    )
  }

  return (
    <span
      role="radiogroup"
      aria-label={label}
      className={cn('inline-flex items-center gap-1.25', className)}
    >
      {Array.from({ length: max }, (_, index) => {
        const score = index + 1
        const filled = (value ?? 0) >= score

        return (
          <button
            key={score}
            type="button"
            role="radio"
            aria-checked={value === score}
            aria-label={`${max}점 중 ${score}점`}
            onClick={() => onChange(score)}
            className={cn(
              'focus-visible:ring-accent-deep rounded-card text-body outline-none focus-visible:ring-2',
              filled ? 'text-ink' : 'text-line',
            )}
          >
            <span aria-hidden>{filled ? '★' : '☆'}</span>
          </button>
        )
      })}
      <span className="text-ink-muted text-caption ml-1.25">
        {value ?? '-'} / {max}
      </span>
    </span>
  )
}
