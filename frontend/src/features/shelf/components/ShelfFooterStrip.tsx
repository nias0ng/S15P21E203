import { cn } from '@/shared/lib/cn'

type Props = {
  /** 1부터 시작하는 현재 순번 */
  index: number
  total: number
  onPrev: () => void
  onNext: () => void
  className?: string
}

/**
 * 진열대 화면 맨 아래 띠 (와이어프레임 A13 하단)
 *
 * `<footer>` 가 아니라 `<div>` 인 이유: 페이지 푸터가 아니라 한 구역의 장식 띠라
 * contentinfo 랜드마크를 만들면 낭독기 목차만 지저분해집니다.
 */
export function ShelfFooterStrip({
  index,
  total,
  onPrev,
  onNext,
  className,
}: Props) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-8 border-t border-[var(--hairline)] pt-4',
        className,
      )}
    >
      <p className="shelf-label leading-relaxed">
        A SCENT BRINGS YOU BACK
        <br />
        TO A MORE TRUE YOU.
      </p>

      {/* ⚠️ 이 묶음이 띠 높이를 정합니다. 선을 길게 하면 하단이 화면 밖으로 밀립니다 */}
      <div className="flex flex-col items-center gap-1.5">
        <span aria-hidden className="shelf-hairline h-5 w-px" />
        <span className="shelf-label">SCROLL</span>
      </div>

      <p className="shelf-muted text-caption leading-relaxed">
        향이 머무는 곳에,
        <br />
        언제나 조금 더 특별한 내가 있습니다.
      </p>

      <div className="flex items-center gap-4">
        {/*
          tabular-nums 로 숫자 폭을 고정합니다 — 9 → 10 에서 옆 화살표까지 흔들립니다.
          aria-live: 화살표를 눌러도 포커스가 버튼에 남아 있어, 읽어주지 않으면
          몇 번째로 옮겨갔는지 알 길이 없습니다.
        */}
        <p aria-live="polite" className="shelf-muted text-body tabular-nums">
          <span className="sr-only">{`${total}개 중 ${index}번째 향수`}</span>
          <span aria-hidden>
            <span className="text-[var(--shelf-ink)]">{index}</span> / {total}
          </span>
        </p>

        <div className="flex items-center gap-2">
          <PagerButton
            label="이전 향수"
            glyph="‹"
            onClick={onPrev}
            disabled={index <= 1}
          />
          <PagerButton
            label="다음 향수"
            glyph="›"
            onClick={onNext}
            disabled={index >= total}
          />
        </div>
      </div>
    </div>
  )
}

/**
 * 글리프만 있는 넘김 버튼.
 *
 * 공용 Button 을 안 쓰는 이유: 어떤 variant 든 채움이나 호버 배경이 생기는데, 이건
 * 종이에 인쇄된 기호처럼 글자색만 바뀌어야 합니다. 비활성도 공통 규칙 중
 * opacity-40 · pointer-events-none 만 가져옵니다 — "테두리만 남기기" 를 적용하면
 * 없던 네모가 생깁니다.
 */
function PagerButton({
  label,
  glyph,
  onClick,
  disabled,
}: {
  label: string
  glyph: string
  onClick: () => void
  disabled: boolean
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        // 글리프 자체는 작아서 size-8 로 누를 수 있는 넓이를 따로 확보합니다
        'flex size-8 items-center justify-center',
        'shelf-muted text-title leading-none hover:text-[var(--shelf-ink)]',
        'transition-colors duration-120 ease-out',
        'rounded-card outline-none focus-visible:ring-2 focus-visible:ring-[var(--shelf-ink)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--paper)]',
        'disabled:pointer-events-none disabled:opacity-40',
      )}
    >
      <span aria-hidden>{glyph}</span>
    </button>
  )
}
