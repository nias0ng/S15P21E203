import { cn } from '@/shared/lib/cn'

import type { PlaqueMetrics } from '../lib'
import { SHELF_CATEGORY_CAPTION, type ShelfCategory } from '../types'

/*
 * 분류 이름 아래 작게 적는 영문 설명은 types.ts 의 SHELF_CATEGORY_CAPTION 입니다 — 상세 카드 머리도
 * 같은 말을 적습니다. 넓은 현판에서만 보이고(PlaqueDetail 'full'), 대문자와 자간은 CSS 가
 * 입힙니다(.shelf-plaque-caption).
 */
const PLAQUE_CAPTION = SHELF_CATEGORY_CAPTION

/** "처음으로" 현판의 영문 설명. 낭독기에는 단추 앞의 "처음으로, " 가 대신 읽힙니다 */
const RETURN_CAPTION = 'Back to start'

type PlaqueProps = {
  label: string
  count: number
  /** 현판 치수와 모양. 벽 하나의 현판이 전부 같아서 ShelfWall 이 한 번 셉니다 */
  plaque: PlaqueMetrics
  /** 누르면 어떻게 되는지 적은 설명 요소의 id */
  hintId: string
  /** 창 안에 있어 탭으로 닿는가. 창 끝에 걸친 기둥은 닿지 않습니다 */
  focusable: boolean
  onShow: () => void
}

type Props = PlaqueProps & {
  /** 제목(h2) id. 분류 section 의 aria-labelledby 가 가리킵니다 */
  id: string
  category: ShelfCategory
}

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
 *
 * 분류 현판(ShelfPlaque)과 "처음으로" 현판(ShelfReturnPlaque)이 같이 씁니다. 둘은 단추 바깥
 * (제목인가 아닌가)과 낭독기 이름 · 영문 설명만 다르고 판은 같습니다 — 판을 한쪽만 고치면 벽
 * 끝의 현판만 다른 종이로 보입니다.
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
 * 이름표 벽 — 벽감 앞 기둥에 분류 이름을 적은 현판을 꽂아 둡니다.
 *
 * **기둥은 칸 두 개 폭입니다**(휴대폰은 한 칸 — lib.ts 의 layoutWall). 칸 폭은 병 한 칸과 같아서
 * 벽 한 줄을 칸 단위로 끊어 세울 수 있습니다(ShelfWall 설명). 기둥 좌우 가장자리(--track-inset)는
 * 이웃 벽감의 옆벽이 차지해서, 현판은 그 안쪽 맨 벽 가운데에 · 벽감 높이의 가운데에 섭니다.
 * 크기와 모양은 칸 폭 · 벽감 높이에서 셉니다(lib.ts 의 "이름표 벽의 현판").
 *
 * 현판은 여러 겹입니다. 겹마다 같은 윤곽(clip-path)으로 오려서 하나의 종이 판으로 보입니다.
 *
 *   종이          크림색 바탕 + 왼쪽 위 빛 + 종이 결
 *   가장자리      바깥 1px 띠. 벽 쪽(오른쪽 아래)으로 갈수록 한 단 짙습니다
 *   빛 받는 띠    그 안쪽 1px. 광원 쪽(왼쪽 위)에만 앉습니다
 *   안쪽 테두리선 윤곽을 따라 도는 가는 선과, 그 안쪽의 옅은 빛(눌러 새긴 선처럼)
 *   포커스 링     키보드로 닿았을 때만
 *
 * 그림자는 오린 겹들을 감싼 상자에 drop-shadow 로 겁니다. 오린 요소에 직접 걸면 그림자가
 * 자기 윤곽에 같이 잘립니다. 벽에 붙은 얇은 판이라 작고 짧게 오른쪽 아래로만 떨어집니다.
 *
 * **누르면 그 분류로 갑니다** — 칩과 같은 일입니다(onShow). 짧은 분류의 첫머리에서는 다음
 * 분류의 기둥이 패널 바로 왼쪽에 서 있어서(lib.ts 의 layoutWall), 그걸 누르면 그 분류가 창
 * 왼쪽 끝부터 들어옵니다.
 *
 * 제목(h2)은 그대로 두고 그 안에 단추를 넣습니다. 분류 section 의 aria-labelledby 가 이
 * 제목을 가리키고, 제목의 이름이 곧 단추의 글자라 "보유 중, 향수 5개" 로 읽힙니다. 단추에
 * aria-label 을 달면 제목의 이름까지 바뀌니 달지 않고, 누르면 어떻게 되는지는 설명
 * (aria-describedby)으로 붙입니다.
 *
 * 창 밖 · 창 끝에 걸친 현판은 탭 순서에서만 뺍니다(tabIndex −1). inert 를 걸면 제목 글자까지
 * 낭독기에서 사라져, 제목으로 건너뛰며 분류를 찾을 수 없습니다. 걸친 현판은 지우지 않고 걸친 채
 * 비치며, 누르면 그 분류로 흐릅니다.
 *
 * ⚠️ 투명도 · 그림자 · 오리기는 현판 안쪽 요소에만 겁니다. 이 기둥은 병 칸(.shelf-slot)이
 * 아니라 걸어도 병 그림자의 겹침 순서에 끼지 않습니다.
 */
export function ShelfPlaque({
  id,
  category,
  label,
  count,
  plaque,
  hintId,
  focusable,
  onShow,
}: Props) {
  return (
    <div className="relative h-full w-[calc(var(--pitch)*var(--plaque-span))] shrink-0">
      <h2
        id={id}
        className="absolute inset-x-[var(--track-inset)] top-0 flex h-[var(--case-h)] items-center justify-center"
      >
        <button
          type="button"
          onClick={onShow}
          aria-describedby={hintId}
          tabIndex={focusable ? undefined : -1}
          // 폭이 좁으면 적는 것을 줄입니다(CSS 의 .shelf-plaque[data-detail])
          data-detail={plaque.detail}
          style={plaqueStyle(plaque)}
          className="shelf-plaque"
        >
          <PlaqueBoard
            label={label}
            count={count}
            caption={PLAQUE_CAPTION[category]}
          />
        </button>
      </h2>
    </div>
  )
}

/**
 * "처음으로" 현판 — 벽 맨 끝(마지막 분류 뒤) 기둥에 첫 분류의 현판을 한 장 더 꽂아 둡니다.
 *
 * 벽 끝에 서면 이 기둥이 패널 바로 왼쪽에 붙어, 마지막 분류의 병을 다 본 자리에서 "여기서 처음으로
 * 돌아간다" 가 보입니다. 판은 첫 분류(보유 중)의 이름 · 개수를 적은 분류 현판과 같고, 넓은 현판의
 * 영문 설명만 "Back to start" 입니다. 누르면 첫 분류의 현판을 누른 것과 같은 일을 합니다 — 첫 향수를
 * 고르고 벽이 맨 앞으로 흐릅니다(ShelfWall).
 *
 * 분류가 아니라서 제목(h2)으로 두지 않고 id 도 없습니다. 제목으로 건너뛰는 낭독기 사용자에게 같은
 * 분류가 두 번 나오지 않게 합니다. 대신 단추 이름 앞에 보이지 않는 "처음으로, " 를 붙여 "처음으로,
 * 보유 중, 향수 5개" 로 읽히고, 어디로 흐르는지는 설명(aria-describedby)으로 붙입니다.
 */
export function ShelfReturnPlaque({
  label,
  count,
  plaque,
  hintId,
  focusable,
  onShow,
}: PlaqueProps) {
  return (
    <div className="relative h-full w-[calc(var(--pitch)*var(--plaque-span))] shrink-0">
      <div className="absolute inset-x-[var(--track-inset)] top-0 flex h-[var(--case-h)] items-center justify-center">
        <button
          type="button"
          onClick={onShow}
          aria-describedby={hintId}
          tabIndex={focusable ? undefined : -1}
          data-detail={plaque.detail}
          style={plaqueStyle(plaque)}
          className="shelf-plaque"
        >
          <span className="sr-only">처음으로, </span>
          <PlaqueBoard label={label} count={count} caption={RETURN_CAPTION} />
        </button>
      </div>
    </div>
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
