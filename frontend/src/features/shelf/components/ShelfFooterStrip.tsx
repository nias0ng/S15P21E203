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
 * 자간을 넓힌 대문자 소형 라벨.
 *
 * 자간만 임의값입니다. `@theme` 에 자간 토큰이 없고, 자간은 색·크기와 달리 시안이
 * 바뀌어도 함께 갈아끼울 대상이 아니라 토큰을 새로 파지 않았습니다.
 * 대문자 라틴 문자는 기본 자간으로는 붙어 보여서 전시 캡션처럼 벌려야 하는데,
 * 0.18em 은 GlobalHeader(0.06em)·StarRating(0.15em) 보다 넓은 이 화면 전용 값입니다.
 *
 * 이 띠 안에서 두 곳이 같은 값을 써야 하므로 문자열을 여기 한 번만 둡니다.
 * 인라인으로 두면 한쪽에만 근거가 붙어서 다른 쪽은 실수처럼 보입니다.
 * `ShelfDetailPanel` 도 같은 상수를 갖고 있습니다 — `--tracking-*` 토큰이
 * 생기면 두 곳을 함께 걷어냅니다.
 */
const SPACED_LABEL = 'shelf-muted text-caption uppercase tracking-[0.18em]'

/**
 * 컬렉션 화면 맨 아래 띠 (와이어프레임 A13 하단)
 *
 * 문구 · SCROLL 표시 · 인용 · 페이지 표시를 한 줄에 늘어놓습니다.
 * 정보가 아니라 진열장의 "명판" 에 가까워서, 위 테두리 한 줄(border-t)로만
 * 본문과 나눕니다. 상자를 만들면 아래쪽이 또 하나의 카드처럼 보입니다.
 *
 * `<footer>` 대신 `<div>` 를 쓰는 이유: `<footer>` 는 body 직속일 때
 * contentinfo 랜드마크가 되는데, 이건 페이지 전체의 푸터가 아니라 화면 한 구역의
 * 장식 띠입니다. 랜드마크를 늘리면 낭독기의 목차만 지저분해집니다.
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
        'flex items-center justify-between gap-8 border-t border-[var(--hairline)] pt-6',
        className,
      )}
    >
      <p className={cn(SPACED_LABEL, 'leading-relaxed')}>
        A SCENT BRINGS YOU BACK
        <br />
        TO A MORE TRUE YOU.
      </p>

      {/* 스크롤 유도. 선이 아래로 이어지는 모양 자체가 "더 있다" 를 말합니다 */}
      <div className="flex flex-col items-center gap-2">
        <span aria-hidden className="shelf-hairline h-8 w-px" />
        <span className={SPACED_LABEL}>SCROLL</span>
      </div>

      <p className="shelf-muted text-caption leading-relaxed">
        향이 머무는 곳에,
        <br />
        언제나 조금 더 특별한 내가 있습니다.
      </p>

      <div className="flex items-center gap-4">
        {/*
          tabular-nums 로 숫자 폭을 고정합니다. 기본 비례 숫자로는 1 이 좁아서
          9 → 10 처럼 자릿수가 바뀔 때 옆의 화살표까지 좌우로 흔들립니다.
          화면에는 목업대로 "3 / 12" 를, 낭독기에는 뜻이 통하는 문장을 들려줍니다.

          aria-live 를 다는 이유: 화살표를 눌러도 포커스는 버튼에 그대로 있어서,
          바뀐 순번을 낭독기가 스스로 읽어주지 않으면 몇 번째로 옮겨갔는지 알 길이
          없습니다. polite 라 사용자가 읽던 문장을 끊지 않고 뒤이어 읽어줍니다.
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
 * 공용 `Button` 을 쓰지 않는 이유는 variant 로 표현할 수 있는 차이가 아니어서입니다.
 * 공용 버튼은 어떤 variant 든 채움이나 호버 배경이 생기는데, 여기 화살표는
 * 종이 위에 인쇄된 기호처럼 배경 없이 글자색만 바뀌어야 합니다.
 *
 * 비활성은 공통 규칙 중 opacity-40 · pointer-events-none 만 가져옵니다.
 * 공통 규칙의 "테두리만 남기기" 는 채움이 있는 버튼에서 채움을 걷어내는 규칙인데,
 * 이 버튼은 원래 테두리도 채움도 없어서 그대로 적용하면 없던 네모가 생겨납니다.
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
