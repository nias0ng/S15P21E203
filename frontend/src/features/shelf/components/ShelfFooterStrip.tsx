import { useTranslation } from 'react-i18next'

import { cn } from '@/shared/lib/cn'

import { ShelfPager } from './ShelfPager'

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
}

/**
 * 진열대 화면 맨 아래 띠 (와이어프레임 A13 하단)
 *
 * 가운데에 진열대 ↔ 내 컬렉션을 바꾸는 단추, 오른쪽에 향수 페이저를 둡니다.
 * 예전에 있던 영문 문구 · SCROLL 표시 · 인용은 걷어냈습니다. 빈 자리는 진열장이
 * 커지는 데 씁니다. SCROLL 표시가 있던 가운데 자리에 "아래에 더 있다" 대신
 * 컬렉션으로 넘어가는 단추가 섭니다 — 화면을 스크롤하지 않고 무대를 바꿉니다.
 *
 * 넓은 화면(한 장 배치)에서만 씁니다. 쌓는 배치는 페이지가 스크롤되어 컬렉션이 진열대
 * 아래에 이어 서고, 페이저만 벽 아래로 옮겨 갑니다(ShelfPager).
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
}: Props) {
  const { t } = useTranslation('shelf')
  const onShelf = view === 'shelf'

  return (
    <div className="grid h-17.5 grid-cols-[1fr_auto_1fr] items-center gap-7.5 border-t border-[var(--hairline)]">
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
            <span className="font-medium">{t('footer.collection')}</span>
            <span className="shelf-muted tabular-nums">{collectionCount}</span>
          </>
        ) : (
          <span className="font-medium">{t('footer.backToShelf')}</span>
        )}
        <Chevron up={!onShelf} />
      </button>

      {onShelf ? (
        <ShelfPager
          index={index}
          total={total}
          onPrev={onPrev}
          onNext={onNext}
          className="justify-self-end"
        />
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
