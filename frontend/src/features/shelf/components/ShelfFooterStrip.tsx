import { cn } from '@/shared/lib/cn'

type Props = {
  /** 지금 보이는 무대 */
  view: 'shelf' | 'collection'
  onToggleView: () => void
  /** 단추에 붙는 내 컬렉션 개수 */
  collectionCount: number
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
 * 가운데에 진열대 ↔ 내 컬렉션을 바꾸는 단추, 오른쪽에 향수 페이저를 둡니다.
 * 예전에 있던 영문 문구 · SCROLL 표시 · 인용은 걷어냈습니다. 빈 자리는 진열장이
 * 커지는 데 씁니다. SCROLL 표시가 있던 가운데 자리에 "아래에 더 있다" 대신
 * 컬렉션으로 넘어가는 단추가 섭니다 — 화면을 스크롤하지 않고 무대를 바꿉니다.
 *
 * 위 테두리 한 줄(border-t)로만 본문과 나눕니다. 상자를 만들면 아래쪽이 또 하나의
 * 카드처럼 보입니다.
 *
 * `<footer>` 대신 `<div>` 를 쓰는 이유: `<footer>` 는 body 직속일 때
 * contentinfo 랜드마크가 되는데, 이건 페이지 전체의 푸터가 아니라 화면 한 구역의
 * 조작 띠입니다. 랜드마크를 늘리면 낭독기의 목차만 지저분해집니다.
 */
export function ShelfFooterStrip({
  view,
  onToggleView,
  collectionCount,
  index,
  total,
  onPrev,
  onNext,
  className,
}: Props) {
  const onShelf = view === 'shelf'

  return (
    <div
      className={cn(
        'grid h-17.5 grid-cols-[1fr_auto_1fr] items-center gap-7.5 border-t border-[var(--hairline)]',
        className,
      )}
    >
      <span aria-hidden />

      {/*
        진열대 ↔ 내 컬렉션. 칩 · 검색창과 같은 알약 모양이라 누를 수 있는 것으로 읽힙니다.
        화살표가 무대가 움직일 방향입니다(컬렉션은 아래에서 올라옵니다).
      */}
      <button
        type="button"
        onClick={onToggleView}
        className={cn(
          'shelf-field text-caption flex h-10 items-center gap-2.5 rounded-full px-5',
          'transition-colors duration-120 ease-out',
          'outline-none focus-visible:ring-2 focus-visible:ring-[var(--shelf-ink)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--paper)]',
        )}
      >
        {onShelf ? (
          <>
            <span className="font-medium">내 컬렉션</span>
            <span className="shelf-muted tabular-nums">{collectionCount}</span>
          </>
        ) : (
          <span className="font-medium">진열대로</span>
        )}
        <Chevron up={!onShelf} />
      </button>

      {onShelf ? (
        <div className="flex items-center gap-3.75 justify-self-end">
          {/*
            tabular-nums 로 숫자 폭을 고정합니다. 기본 비례 숫자로는 1 이 좁아서
            9 → 10 처럼 자릿수가 바뀔 때 옆의 화살표까지 좌우로 흔들립니다.
            화면에는 "3 / 12" 를, 낭독기에는 뜻이 통하는 문장을 들려줍니다.

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

          <div className="flex items-center gap-2.5">
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
      ) : (
        <span aria-hidden />
      )}
    </div>
  )
}

/** 무대가 움직일 방향 */
function Chevron({ up }: { up: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden
      className="size-3.75 transition-transform duration-120 ease-out"
      style={{ transform: up ? 'rotate(180deg)' : undefined }}
    >
      <path
        d="M3.5 6 8 10.5 12.5 6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
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
        // 글리프 자체는 작아서 size-7.5 로 누를 수 있는 넓이를 따로 확보합니다
        'flex size-7.5 items-center justify-center',
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
