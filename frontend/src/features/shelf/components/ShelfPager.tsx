import { useTranslation } from 'react-i18next'

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
 * 향수 페이저 — "3 / 25" 와 앞뒤 넘김.
 *
 * 넓은 화면에서는 하단 띠(ShelfFooterStrip) 오른쪽에, 쌓는 배치에서는 벽 바로 아래에
 * 섭니다. 세 분류를 벽 순서대로 이어 한 병씩 넘기고, 고른 병이 창 밖이면 벽이 따라
 * 흐릅니다(ShelfWall).
 */
export function ShelfPager({ index, total, onPrev, onNext, className }: Props) {
  const { t } = useTranslation('shelf')
  return (
    <div className={cn('flex items-center gap-3.75', className)}>
      {/*
        tabular-nums 로 숫자 폭을 고정합니다. 기본 비례 숫자로는 1 이 좁아서
        9 → 10 처럼 자릿수가 바뀔 때 옆의 화살표까지 좌우로 흔들립니다.
        화면에는 "3 / 12" 를, 낭독기에는 뜻이 통하는 문장을 들려줍니다.

        aria-live 를 다는 이유: 화살표를 눌러도 포커스는 버튼에 그대로 있어서,
        바뀐 순번을 낭독기가 스스로 읽어주지 않으면 몇 번째로 옮겨갔는지 알 길이
        없습니다. polite 라 사용자가 읽던 문장을 끊지 않고 뒤이어 읽어줍니다.
      */}
      <p aria-live="polite" className="shelf-muted text-body tabular-nums">
        <span className="sr-only">{t('pager.position', { total, index })}</span>
        <span aria-hidden>
          <span className="text-[var(--shelf-ink)]">{index}</span> / {total}
        </span>
      </p>

      <div className="flex items-center gap-2.5">
        <PagerButton
          label={t('pager.prev')}
          glyph="‹"
          onClick={onPrev}
          disabled={index <= 1}
        />
        <PagerButton
          label={t('pager.next')}
          glyph="›"
          onClick={onNext}
          disabled={index >= total}
        />
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
