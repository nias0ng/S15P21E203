import { cn } from '@/shared/lib/cn'

import type { PlaqueMetrics } from '../lib'
import { SHELF_CATEGORY_CAPTION, type ShelfCategory } from '../types'

/*
 * 분류 이름 아래 작게 적는 영문 설명은 types.ts 의 SHELF_CATEGORY_CAPTION 입니다 — 상세 카드 머리도
 * 같은 말을 적습니다. 넓은 현판에서만 보이고(PlaqueDetail 'full'), 대문자와 자간은 CSS 가
 * 입힙니다(.shelf-plaque-caption).
 */
const PLAQUE_CAPTION = SHELF_CATEGORY_CAPTION

/** 현판 치수 · 윤곽을 단추의 CSS 변수로 넣습니다(shelf-display.css 의 .shelf-plaque) */
function plaqueStyle(plaque: PlaqueMetrics) {
  return {
    '--plaque-w': `${plaque.width}px`,
    '--plaque-h': `${plaque.height}px`,
    '--plaque-crown': `${plaque.crown}px`,
    '--plaque-inset': `${plaque.inset}px`,
    '--plaque-shape': plaque.shape,
    '--plaque-edge-ring': plaque.edgeRing,
    '--plaque-rim-ring': plaque.rimRing,
    '--plaque-line-ring': plaque.lineRing,
    '--plaque-glint-ring': plaque.glintRing,
    '--plaque-focus-ring': plaque.focusRing,
  } as React.CSSProperties
}

/**
 * 현판 한 장 — 오린 종이 겹 · 글자(분류 이름 · 짧은 선 · 개수 · 영문 설명). 꼭대기에 꽂던 황동 핀은
 * 걷었습니다(S15P21E203-431).
 */
function PlaqueBoard({
  label,
  count,
  caption,
}: {
  label: string
  count: number
  caption: string
}) {
  return (
    <>
      <span aria-hidden className="shelf-plaque-board">
        <span className="shelf-plaque-paper" />
        {/* 눌러 들어간 판에 드는 먹빛과 윗턱 그늘. 고른 판에서만 떠오릅니다(shelf-display.css) */}
        <span className="shelf-plaque-well" />
        <span className="shelf-plaque-edge" />
        <span className="shelf-plaque-rim" />
        <span className="shelf-plaque-line" />
        <span className="shelf-plaque-glint" />
        <span className="shelf-plaque-focus" />
      </span>
      <span className="shelf-plaque-text">
        <span className="shelf-plaque-label font-serif font-semibold">
          {label}
        </span>
        <span aria-hidden className="shelf-plaque-rule" />
        <span className="shelf-plaque-count font-serif font-semibold tabular-nums">
          <span className="sr-only">, 향수 </span>
          {count}
          <span className="sr-only">개</span>
        </span>
        <span aria-hidden lang="en" className="shelf-plaque-caption">
          {caption}
        </span>
      </span>
    </>
  )
}

/**
 * 왼쪽에 세로로 쌓는 분류 메뉴 (S15P21E203-417).
 *
 * 벽감이 창에 고정이라 벽에는 한 번에 한 분류만 섭니다. 분류를 갈아끼우는 손잡이가 이 메뉴입니다.
 *
 * 판은 분류 현판과 같은 종이지만 셋이 벽감 높이 안에 들어가야 해서 낮습니다 — 높이 상한은
 * ShelfWall 이 벽감 높이에서 세어 `plaqueMetrics` 에 넘깁니다(lib.ts 의 maxHeight).
 *
 * 고른 분류는 `aria-current` 로 알리고, 보이는 표시는 `data-active` 로 CSS 가 입힙니다.
 * 낭독기에는 분류 이름과 개수가 그대로 읽힙니다(PlaqueBoard).
 *
 * ── 누르는 맛 (S15P21E203-431) ──────────────────────────────
 * 판은 **눌러 두는 단추**입니다 — 옛 라디오의 프리셋 단추처럼, 고른 판은 벽 쪽으로 눌려 들어가 **먹빛으로
 * 채워진 채**(글자는 종이색) 머물고 나머지는 벽에서 떠 그림자를 드리웁니다. 누르는 순간 판이 한 번 더
 * 깊이 눌렸다 제자리에 앉고, 먼저 눌려 있던 판은 튕기듯 떠오릅니다. 판 오른쪽의 황동 촉이 고른 판으로
 * 미끄러져 벽감을 가리킵니다 — "이 판이 저 벽을 정한다" 가 이어집니다. 모양은 전부 shelf-display.css 의
 * "누르는 맛".
 * 벽도 같이 대답합니다 — 옛 병이 문으로 빠지고 새 병이 들어옵니다(ShelfWall 의 "분류를 바꿀 때").
 */
export function ShelfPlaqueMenu({
  items,
  value,
  plaque,
  hintId,
  onSelect,
  className,
}: {
  items: { category: ShelfCategory; label: string; count: number }[]
  value: ShelfCategory
  plaque: PlaqueMetrics
  hintId: string
  onSelect: (category: ShelfCategory) => void
  className?: string
}) {
  const at = Math.max(
    0,
    items.findIndex((item) => item.category === value),
  )
  return (
    <nav
      aria-label="진열대 분류"
      className={cn(
        'relative flex flex-col items-center justify-between',
        className,
      )}
      style={
        {
          '--plaque-w': `${plaque.width}px`,
          '--plaque-h': `${plaque.height}px`,
          '--menu-at': at,
          '--menu-gaps': Math.max(1, items.length - 1),
        } as React.CSSProperties
      }
    >
      {/*
        황동 촉 — 고른 판 오른쪽에서 벽감을 가리킵니다. 판들은 세로로 고르게 벌어져 있어(justify-between)
        n 번째 판의 가운데가 판 높이 절반 + n x (메뉴 높이 − 판 높이) / 칸 사이 수 에 옵니다.
      */}
      <span aria-hidden className="shelf-menu-pointer" />
      {items.map((item) => {
        const active = item.category === value
        return (
          <button
            key={item.category}
            type="button"
            onClick={() => onSelect(item.category)}
            aria-describedby={hintId}
            aria-current={active ? 'true' : undefined}
            data-detail={plaque.detail}
            data-active={active ? '' : undefined}
            // 누운 판(메뉴판)은 글자를 가로로 폅니다 — 세로로 쌓으면 판 밖으로 넘칩니다
            data-wide={plaque.width > plaque.height ? '' : undefined}
            style={plaqueStyle(plaque)}
            className="shelf-plaque"
          >
            <PlaqueBoard
              label={item.label}
              count={item.count}
              caption={PLAQUE_CAPTION[item.category]}
            />
          </button>
        )
      })}
    </nav>
  )
}
