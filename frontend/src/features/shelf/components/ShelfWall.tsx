import {
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type Ref,
} from 'react'
import { flushSync } from 'react-dom'

import { useDiveReady } from '@/shared/hooks/useDiveReady'
import { cn } from '@/shared/lib/cn'

import { useBottlePreload } from '../hooks/useBottlePreload'
import { useShelfFlow } from '../hooks/useShelfFlow'
import { useTagSwing } from '../hooks/useTagSwing'
import {
  doorMetrics,
  layoutWall,
  plaqueMetrics,
  revealItem,
  shelfLayout,
  TAG_WIDTH,
  tagMetrics,
  wallStops,
  type GustDirection,
  type WallSection,
} from '../lib'
import {
  SHELF_CATEGORIES,
  type ShelfCategory,
  type ShelfItem,
  type ShelfSection,
} from '../types'

import { DisplayCase } from './DisplayCase'
import { ShelfPlaqueMenu } from './ShelfPlaque'

/**
 * 왼쪽 분류 메뉴에서 현판 사이에 두는 간격 — 벽감 높이 대비 비율입니다. 셋을 세로로 쌓고
 * 남는 자리를 사이에 고루 나누므로, 현판 높이의 상한이 이 값으로 정해집니다.
 */
const MENU_GAP = 0.04

/**
 * 메뉴판 크기 — 기둥 폭과 벽감 높이 대비입니다. 값을 만지면 판이 통째로 커지고 작아집니다.
 * 글자 크기는 판 폭을 따라가므로(shelf-display.css 의 .shelf-plaque-label · -count) 너무
 * 줄이면 이름이 두 줄로 접힙니다 — 1920 에서 폭 165 언저리가 한 줄로 서는 아래끝입니다.
 */
const MENU_WIDTH_SHARE = 0.85
const MENU_HEIGHT_SHARE = 0.22

/** 분류 메뉴 위의 머리줄(검색창 · 등록 단추)이 기둥 높이에서 쓰는 몫 */
const MENU_HEADER_SHARE = 0.2

export type ShelfWallHandle = {
  /**
   * 진열대 ↔ 내 컬렉션 무대를 바꾸기 직전에 부르세요. 이름표에 아래에서 바람이 불어 앞으로 들렸다
   * 가라앉습니다 — 진열대가 위로 빠질 때(leave) · 돌아올 때(arrive). 움직임을 줄이도록 설정한
   * 사용자에게는 아무 일도 하지 않습니다(useTagSwing).
   */
  gust: (direction: GustDirection) => void
}

type Props = {
  ref?: Ref<ShelfWallHandle>
  sections: ShelfSection[]
  /**
   * 벽에 서는 분류 (S15P21E203-417). 벽감이 창에 고정이라 한 번에 하나만 섭니다 —
   * 갈아끼우는 것은 왼쪽 현판 메뉴입니다. 값이 바뀌면 벽이 옛 분류를 한쪽 문으로 흘려보내고 새
   * 분류를 반대쪽 문에서 들입니다(아래 "분류를 바꿀 때").
   */
  category: ShelfCategory
  selectedId: number | null
  onSelect: (item: ShelfItem) => void
  /**
   * 벽에 서는 분류가 바뀌어야 할 때 — 메뉴를 눌렀거나, 고른 병(하단 페이저)이 다른 분류로 넘어갔을
   * 때입니다. 화면이 받아 `category` 로 돌려줍니다.
   */
  onViewCategoryChange: (category: ShelfCategory) => void
  /**
   * 메뉴에서 분류를 골랐을 때. 그 분류의 첫 향수를 고르도록 화면이 넘깁니다. 벽을 옮기는 일은
   * 벽이 스스로 합니다(`category` 가 바뀌면).
   */
  onPlaqueSelect?: (category: ShelfCategory) => void
  /** 이 값이 바뀌면 벽을 맨 앞으로 되돌립니다(검색어) */
  resetKey: string
  /** 향수가 없는 분류의 벽감에 적는 말 */
  emptyMessage: string
  /** 벽 오른쪽 위에 얹히는 상세 패널. 주지 않으면 패널 없이 창 전체를 씁니다(쌓는 배치) */
  aside?: ReactNode
  /** 분류 메뉴 위에 놓는 줄(검색창 · 등록 단추). 메뉴 기둥 폭 안에 세로로 섭니다 */
  menuHeader?: ReactNode
  className?: string
}

/** 첫 화면 — 크기를 잰 첫 그림의 창에 걸친 칸(벽 첫 칸부터 센 순서, to 포함)과 그때 고른 병 */
type FirstScreen = { from: number; to: number; id: number | null }

/**
 * 분류를 바꾸는 중 — 옛 분류(from)와 새 분류(to)를 벽에 나란히 세워 두고 흘려 보냅니다.
 *
 *   forward  메뉴에서 아래 분류로 → [옛][새] 로 세우고 새 분류 첫머리까지 흐릅니다(옛 병은 왼쪽 문으로)
 *   backward 위 분류로           → [새][옛] 로 세우고 맨 앞(새 분류 첫머리)까지 거꾸로 흐릅니다
 *
 * 옛 분류는 **바꾸던 순간 창에 보이던 병만**(`keep`, 병 순서 [처음, 끝)) 세우고, 거꾸로 갈 때는 새 분류도
 * 첫머리 한 창만 세웁니다. 병이 서른인 분류에서 바꿔도 벽이 서른 칸을 훑지 않고 늘 한 창 남짓만
 * 흐릅니다 — 누른 것에 대한 대답이 1초를 넘기지 않습니다. 잘린 병들은 어차피 창 밖이라 안 보입니다.
 */
type Passage = {
  from: ShelfCategory
  to: ShelfCategory
  forward: boolean
  keep: readonly [number, number]
}

/** 메뉴 순서(보유 중 → 시향해 봄 → 보유 희망). 벽이 흐르는 방향을 이 순서로 정합니다 */
const categoryRank = (category: ShelfCategory) =>
  SHELF_CATEGORIES.findIndex((entry) => entry.value === category)

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false)

/**
 * 진열대 벽 (A13 재디자인) — 창에 고정된 벽감 하나에 한 분류의 병이 서고, 왼쪽 메뉴판이 분류를
 * 갈아끼웁니다(S15P21E203-417).
 *
 *   [메뉴: 보유 중 · 시향해 봄 · 보유 희망] [문 | 벽감 — 병이 흐르는 자리 | 문] [상세 패널]
 *
 * 휠을 굴리면 병 줄이 한 번에 한 칸씩 좌우로 흐르고(useShelfFlow), 창 왼쪽 끝이 칸 경계에
 * 자석처럼 붙어 섭니다. 칸 폭이 전부 같아서 칸 단위로 끊어 세우는 것만으로 병이 창 왼쪽 끝에 걸리지
 * 않습니다(lib.ts 의 "칸이 패널 경계에 섭니다").
 *
 * ── 옆벽의 문 (S15P21E203-431) ────────────────────────────────
 * 벽감 좌우 옆벽에 아치 문이 있어, 흐르는 병은 뒷벽 모서리에서 끊기지 않고 옆벽 앞을 지나 문 안
 * 어둠으로 들어갑니다(lib.ts 의 doorMetrics · shelf-display.css 의 "옆벽의 문"). 병이 서는 자리는
 * 앞기둥에서 앞기둥까지 자르고(.shelf-track-clip), 문 안 그늘은 병 위에 얹습니다(.shelf-niche-front).
 *
 * ── 분류를 바꿀 때 (S15P21E203-431) ─────────────────────────────
 * 메뉴판을 누르면 벽이 곧바로 갈아 끼워지지 않고, **옛 병들이 한쪽 문으로 빠져나가고 새 병들이 반대쪽
 * 문에서 들어옵니다.** 메뉴에서 아래 분류로 가면 왼쪽 문으로 빠지고(벽이 왼쪽으로 흐름), 위 분류로
 * 가면 오른쪽 문으로 빠집니다 — 메뉴의 위아래가 벽의 좌우와 같은 순서라 어디로 갔는지 이어집니다.
 * 그동안은 두 분류를 벽에 나란히 세워 두고(`Passage`) 휠과 같은 흐름으로 옮긴 뒤, 다 오면 옛 분류를
 * 치우고 위치를 그만큼 되돌립니다(useShelfFlow 의 rebase) — 화면에서는 아무것도 튀지 않습니다.
 * 이름표가 흐름을 따라 흔들려(useTagSwing) 누른 것이 벽을 움직였다는 게 보입니다.
 * 움직임을 줄인 사용자 · 크기를 재기 전 · 전환 중에 또 누른 경우 · 둘 다 빈 분류면 곧바로 갈아 끼웁니다.
 *
 * 예전에는 세 분류가 한 자리에 겹쳐 휠로 위아래로 바뀌었고, 한 분류 안에서는 일곱 칸
 * 창을 화살표로 세 칸씩 밀었습니다. 분류를 넘나들 때와 분류 안을 훑을 때의 조작이 달라서,
 * 휠 한 번이 무엇을 할지 화면을 보고 알 수 없었습니다. 지금은 휠이 언제나 옆으로 흐릅니다.
 *
 * ── 상세 패널은 벽 위에 얹힙니다 ─────────────────────────────
 * 벽은 화면 오른쪽 끝까지 이어지고, 상세 패널이 그 오른쪽 위에 벽감과 같은 높이로 얹힙니다.
 * 화면이 작아져 벽감이 낮아지면 패널도 같은 비율로 통째로 줄어듭니다(lib.ts 의 shelfLayout).
 * 패널이 아주 옅게 비쳐서(.shelf-panel) 그 밑으로 병이 더 이어진다는 게 보입니다. 그래서
 * 칸 수를 세 가지로 셉니다(lib.ts 의 shelfMetrics).
 *
 *   visible  창에 걸치는 칸(패널 밑까지, 창 오른쪽 끝에 걸린 칸 포함) — 창 밖 병 감추기
 *   whole    창 안에 온전히 드는 칸 — 창 오른쪽 끝에 걸린 칸 지우기
 *   clear    패널에 가리지 않는 칸 — 고른 병 들이기 · 벽 끝 · 칩 켜짐 · 멈출 자리 · 오른쪽 화살표 자리 · 빈 벽 길이
 *
 * ── 크기 ─────────────────────────────────────────────────
 * 벽감 높이 · 칸 폭 · 매달린 이름표 · 상세 패널 크기는 이 자리의 크기에서 계산합니다(lib.ts 의
 * shelfLayout). 화면이 고정 한 장이라, 머리말 부제와 하단 문구를 걷어낸 세로 공간을 진열장이 씁니다.
 * 진열장은 제목 줄 바로 아래에 붙이고, 남는 세로 공간은 아래(하단 띠 위)로 보냅니다.
 * 계산한 값은 CSS 변수로 넣고, 모양은 CSS 가 그립니다.
 *
 *   --case-h · --bottle-h · --pitch       벽감 높이 · 병 높이 · 칸 폭
 *   --clear-w · --panel-scale             패널에 가리지 않는 폭(패널 왼쪽 끝) · 상세 패널 배율
 *   --plaque-span                         이름표 벽 기둥의 칸 수(2, 휴대폰은 1)
 *   --hang-h · --cord-h                   벽감 아래 이름표 자리 높이 · 줄 길이
 *   --tag-w · --tag-h · --tag-scale       태그 폭 · 높이 · 태그 폭 170 대비 배율
 *   --tag-notch · --tag-inset · …         태그 모서리 파임 · 테두리선 · 아일릿 · 선반 고리 · 윤곽(clip-path)
 *
 * 각 값의 뜻과 1920 x 1080 값은 shelf-display.css 의 .shelf-scope 기본값과 이름표 설명 옆에 적어
 * 두었습니다. 태그 모양은 lib.ts 의 tagMetrics 가 태그 폭 · 높이에서 세고, 낮은 태그에서 적는 줄 수는
 * 트랙의 data-tag-detail 로 넘깁니다.
 * 이름표 벽의 현판도 같은 칸 폭 · 벽감 높이 · 기둥 칸 수에서 치수와 윤곽을 셉니다(lib.ts 의
 * plaqueMetrics). 그 값은 현판 단추에 따로 넣습니다(ShelfPlaque).
 *
 * ── 창 밖 병 ───────────────────────────────────────────────
 * 멈춘 칸을 기준으로 창 밖 병과 창 끝에 걸친 병(창 왼쪽 바로 앞 칸, 창 오른쪽 끝(패널 밑)에 걸린 칸과
 * 그다음 칸 — lib.ts 의 slotView)은 inert 로 탭 순서에서 뺍니다. 이름표 벽 기둥은 두 칸 중 하나라도
 * 걸친 칸이면 탭으로 닿지 않습니다.
 *
 * 걸친 병은 지우지 않습니다. 창 마스크의 페이드를 따라 걸친 채 비치고, 벽이 설 때는 용수철이 끝을
 * 천천히 끌어당겨 칸에 붙입니다(useShelfFlow). 예전에는 멈추면 걸친 이웃을 200ms 에 걸쳐 투명하게
 * 지워서 창 끝에서 병이 스르르 사라졌습니다.
 *
 * 흐르는 중이라는 표시(data-moving)는 React 상태가 아니라 트랙 · 창 · 패널 자리에 **직접** 씁니다.
 * 상태로 들었을 때는 흐르기 시작할 때와 설 때마다 벽 전체가 다시 그려져(병 칸 서른 개 남짓의 inert ·
 * tabindex 가 한꺼번에 뒤집힘) 그 프레임이 50~80ms 로 늘었고, 벽이 출발하며 멈칫하고 서면서 병이
 * 깜빡였습니다. 지금 상태는 멈춘 칸 하나이고, 벽감(DisplayCase)은 memo 라 설 때 창 경계가 바뀐 벽감
 * 두셋만 다시 그립니다.
 *
 * 사진은 처음에 전부 받습니다. 첫 화면 병은 먼저 받아 그 자리에서 풀고, 나머지는 창 가운데에서 가까운
 * 병부터 두 장씩 풀어 둔 뒤 한 번만 드러냅니다(useBottlePreload). 흐르는 중에 사진을 새로 받거나
 * 푸느라 병이 비지 않습니다.
 *
 * ── 접근성 ─────────────────────────────────────────────
 * 휠은 **보조 수단**입니다. 칩(분류의 첫머리로)과 하단 페이저(한 병씩)가 키보드로
 * 닿고, 페이저로 고른 병이 가리지 않는 자리 밖이면 벽이 따라 흐릅니다. 넘칠 때는 벽 양
 * 끝에 화살표도 뜹니다.
 */
export function ShelfWall({
  ref,
  sections,
  category,
  selectedId,
  onSelect,
  onViewCategoryChange,
  onPlaqueSelect,
  resetKey,
  emptyMessage,
  aside,
  menuHeader,
  className,
}: Props) {
  const areaRef = useRef<HTMLDivElement>(null)
  const viewportRef = useRef<HTMLElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const idPrefix = useId()
  const plaqueHintId = `${idPrefix}-plaque-hint`

  /*
   * 진열장 자리의 크기. 높이는 이 컴포넌트 전체(무대가 남긴 세로 공간), 폭은 창 전체입니다.
   * 패널 폭은 재지 않고 이 크기에서 계산합니다 — 패널 폭이 벽감 높이를 따라 바뀌어서, 잰
   * 폭으로 다시 셈하면 폭과 벽감 높이가 서로를 쫓아 오갑니다. 크기를 재기 전에는 벽을
   * 그리지 않습니다 — 예전 치수로 한 번 그렸다가 바꾸면 병이 한 프레임 작게 보였다 커집니다.
   */
  const [size, setSize] = useState({ width: 0, height: 0 })
  useEffect(() => {
    const area = areaRef.current
    if (!area || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => {
      const width = area.clientWidth
      const height = area.clientHeight
      setSize((prev) =>
        prev.width === width && prev.height === height
          ? prev
          : { width, height },
      )
    })
    observer.observe(area)
    return () => observer.disconnect()
  }, [])

  const measured = size.width > 0 && size.height > 0
  const withPanel = aside != null
  const metrics = shelfLayout(size.width, size.height, { panel: withPanel })

  /*
   * 칸 수 — **메뉴 기둥을 뺀 값**입니다 (S15P21E203-417).
   *
   * 치수(shelfLayout)는 진열장 자리 **전체 폭**으로 셉니다. 흐르는 창이 아니라 바깥 상자를
   * 재는 까닭이 여기 있습니다 — 창은 왼쪽 메뉴 기둥(`--pitch` × `--plaque-span`)만큼 들어가
   * 있는데, 그 기둥 폭이 다시 `--pitch` 에서 나옵니다. 창을 재면 **폭 → pitch → 창 폭** 으로
   * 되먹임 고리가 돌아 값이 한 프레임씩 튕깁니다(1180 폭에서 881 ↔ 880 · 109.6 ↔ 109.8px).
   *
   * 그래서 폭은 흔들리지 않는 바깥 상자에서 재고, 창이 좁은 만큼을 **칸 수에서** 덜어냅니다.
   * 예전 벽에서 이름표 기둥이 차지하던 그 칸입니다 — 기둥이 트랙 밖으로 나갔을 뿐, 격자에서
   * 차지하는 자리는 같습니다.
   */
  const menuSpan = metrics.plaqueSpan
  const clear = Math.max(1, metrics.clear - menuSpan)
  const visible = Math.max(1, metrics.visible - menuSpan)
  const whole = Math.max(1, metrics.whole - menuSpan)
  /** 멈춘 칸. 창 밖 병 · 화살표를 여기에 맞춥니다. 흐르는 중인지는 상태로 들지 않습니다(위 "창 밖 병") */
  const [view, setView] = useState({ start: 0 })

  /*
   * 분류를 바꾸는 중인가(위 "분류를 바꿀 때"). `category` 가 바뀐 그 렌더에서 곧바로 정합니다 —
   * 효과에서 정하면 새 분류 하나만 선 벽이 한 번 그려졌다가(옛 분류의 병이 통째로 빠졌다가) 다시
   * 두 분류로 그려져, 옛 병 사진이 새 요소로 다시 만들어집니다.
   */
  const [seenCategory, setSeenCategory] = useState(category)
  const [passage, setPassage] = useState<Passage | null>(null)
  if (seenCategory !== category) {
    setSeenCategory(category)
    const from = sections.find((section) => section.category === seenCategory)
    const to = sections.find((section) => section.category === category)
    const glides =
      measured &&
      passage === null &&
      !prefersReducedMotion() &&
      from !== undefined &&
      to !== undefined &&
      (from.items.length > 0 || to.items.length > 0)
    setPassage(
      glides
        ? {
            from: seenCategory,
            to: category,
            forward: categoryRank(category) > categoryRank(seenCategory),
            // 창 왼쪽 문에 걸친 한 병부터 창 오른쪽 문에 걸친 병까지
            keep: [Math.max(0, view.start - 1), view.start + visible + 1],
          }
        : null,
    )
  }

  /*
   * 벽에 세울 분류. 벽감이 창에 고정이라 평소에는 한 분류만 서고, 흐르는 것은 그 안의 병뿐입니다.
   * 분류를 바꾸는 동안만 옛 분류와 새 분류가 흐르는 방향 순서로 나란히 섭니다(`Passage` — 옛 분류는
   * 보이던 병만, 거꾸로 갈 때의 새 분류는 첫머리 한 창만).
   * 현판이 트랙 밖(왼쪽 메뉴)에 서므로 기둥 칸 수는 0 입니다(lib.ts 의 layoutWall).
   */
  const shown = useMemo(() => {
    const pick = (value: ShelfCategory) =>
      sections.find((section) => section.category === value)
    if (passage === null) {
      const only = pick(category)
      return only ? [only] : []
    }
    const leaving = pick(passage.from)
    const coming = pick(passage.to)
    if (!leaving || !coming) return []
    const kept = { ...leaving, items: leaving.items.slice(...passage.keep) }
    return passage.forward
      ? [kept, coming]
      : [{ ...coming, items: coming.items.slice(0, clear + 1) }, kept]
  }, [sections, category, passage, clear])
  const layout = useMemo(() => layoutWall(shown, clear, 0), [shown, clear])
  // 옆벽의 문 — 벽감 높이 · 병 높이에서 셉니다(lib.ts 의 doorMetrics)
  const door = useMemo(
    () => doorMetrics(metrics.caseHeight, metrics.bottle),
    [metrics.caseHeight, metrics.bottle],
  )
  // 이름표 벽의 현판. 세 분류와 "처음으로" 가 같은 치수 · 모양이라 한 번만 셉니다
  const plaque = useMemo(
    () =>
      plaqueMetrics(metrics.pitch, metrics.caseHeight, metrics.plaqueSpan, {
        /*
         * 셋이 벽감 높이 안에 들어가야 하고(사이 간격 둘을 빼고 셋으로 나눈 값), 그보다 더
         * 작게 두고 싶으면 MENU_HEIGHT_SHARE 가 잡습니다 — 둘 중 작은 쪽이 이깁니다.
         */
        maxHeight: Math.min(
          (metrics.caseHeight * (1 - MENU_HEADER_SHARE)) / 3 -
            Math.round(metrics.caseHeight * MENU_GAP),
          metrics.caseHeight * MENU_HEIGHT_SHARE,
        ),
        maxWidth: metrics.pitch * metrics.plaqueSpan * MENU_WIDTH_SHARE,
        // 어깨를 올리지 않고 모서리만 둥근 네모로 그립니다
        plate: true,
        /*
         * 폭을 벽감 높이에 묶던 굴레를 풉니다. 세로로 길던 현판은 그 비율(29%)이 기둥 안에서
         * 알맞았지만, 낮게 누운 메뉴판이 같은 굴레를 쓰면 기둥 301 에 판 135 로 절반도 못 쓰고
         * 정사각형이 됩니다. 풀어 두면 남은 굴레인 맨 벽 폭(PLAQUE_WALL_SHARE)이 폭을 정합니다.
         */
        widthPerCase: Infinity,
      }),
    [metrics.pitch, metrics.caseHeight, metrics.plaqueSpan],
  )
  // 매달린 이름표의 모양(파낸 모서리 · 테두리선 · 아일릿)과 적는 줄 수. 태그가 전부 같아서 한 번만 셉니다
  const tag = useMemo(
    () => tagMetrics(metrics.tagWidth, metrics.tagHeight),
    [metrics.tagWidth, metrics.tagHeight],
  )
  /*
   * 창 왼쪽 끝이 설 수 있는 마지막 칸. 마지막 병까지 패널에 가리지 않는 자리로 끌어올 수
   * 있어야 하고, 마지막 분류도 칩으로 고르면 그 이름표가 창 왼쪽 끝에 서야 합니다. 여기에
   * 서면 "처음으로" 기둥이 패널 바로 왼쪽에 붙습니다(lib.ts 의 layoutWall).
   */
  const max = Math.max(0, layout.total - clear)
  /** 멈출 수 있는 칸 — 이름표 벽 기둥이 창 경계에 잘리는 칸을 뺍니다(lib.ts 의 wallStops) */
  const stops = useMemo(
    () => wallStops(layout, clear, max),
    [layout, clear, max],
  )

  /** 움직이기 시작한 횟수. 멈춤을 한 박자 늦춰 그리는 사이 다시 움직이기 시작했는지 봅니다 */
  const motions = useRef(0)
  /** 흐르는 중인 분류 전환. 흐름 엔진의 콜백(onSettle)이 읽어서 상태가 아니라 ref 로도 듭니다 */
  const passageRef = useRef<Passage | null>(null)
  /** 벽이 섰기 때문에 끝난 전환인가. 아니면(전환 중에 또 누름 · 검색) 새 분류 첫머리로 곧바로 옮깁니다 */
  const passageEnding = useRef(false)
  /** 전환이 끝나 옛 분류를 치울 때 되돌릴 칸 수 */
  const passageShift = useRef(0)
  /** 흐름의 좌표가 가리키는 분류. 흐르지 않고 갈아 끼웠을 때 맨 앞으로 옮길지 봅니다 */
  const placedCategory = useRef(category)
  /** 이름표 흔들기 — 벽이 흐를 때(kick) · 무대가 바뀔 때(gust, 패널 자리에 data-gust) */
  const swing = useTagSwing(trackRef, viewportRef, panelRef)

  /** 흐르는 중(data-moving)을 트랙 · 창 · 패널 자리에 걸거나 뗍니다. React 가 그리지 않는 속성입니다 */
  const markMoving = (moving: boolean) => {
    for (const element of [
      trackRef.current,
      viewportRef.current,
      panelRef.current,
    ]) {
      if (!element) continue
      if (moving) element.setAttribute('data-moving', '')
      else element.removeAttribute('data-moving')
    }
  }

  /*
   * 첫 화면 — 크기를 잰 첫 그림에서 창에 걸친 칸(창 오른쪽 끝의 이웃까지)과 그때 고른 병. 이 병들의
   * 사진은 먼저 받아 그 자리에서 풉니다(DisplayCase). 한 번 정하면 바꾸지 않습니다 — 받기 순위는
   * 처음 받을 때만 뜻이 있고, 벽이 흐르거나 창 크기가 바뀔 때마다 바꾸면 이미 받은 사진의 속성만
   * 다시 씁니다. 크기를 잰 그 그림 안에서 정해서, 벽감이 처음 그려질 때부터 이 값을 받습니다.
   */
  const [firstScreen, setFirstScreen] = useState<FirstScreen | null>(null)
  if (measured && firstScreen === null) {
    setFirstScreen({
      from: view.start,
      to: view.start + visible,
      id: selectedId,
    })
  }

  const firstScreenIn = useBottlePreload(
    trackRef,
    layout.sections,
    view.start,
    clear,
    measured,
  )
  /*
   * 메인에서 잠수로 들어왔으면 커튼에 **첫 화면 병까지 섰다**고 알립니다 — 여기가 그걸 아는
   * 유일한 자리입니다(사진을 푸는 것이 이 벽입니다). 잠수로 들어온 것이 아니면 아무 일도
   * 일어나지 않습니다.
   *
   * ⚠ 유예를 안 겁니다. 이쪽이 **빠른 길**이고, 늦어질 때를 받치는 유예는 화면 쪽
   *   목록 신호가 듭니다 (`MyShelfPage` 의 `READY_GRACE_MS`). 둘 중 먼저 온 쪽이 이깁니다.
   */
  useDiveReady(firstScreenIn)

  /*
   * 병을 눌렀을 때. 화면이 넘기는 함수(useShelfBrowser 의 select)는 그릴 때마다 새로 만들어져서,
   * 그대로 넘기면 memo 한 벽감이 전부 다시 그려집니다. 늘 같은 함수를 넘기고 그 안에서 최신 함수를 부릅니다.
   */
  const latestSelect = useRef(onSelect)
  useLayoutEffect(() => {
    latestSelect.current = onSelect
  })
  const select = useCallback(
    (item: ShelfItem) => latestSelect.current(item),
    [],
  )

  const flow = useShelfFlow({
    viewport: viewportRef,
    track: trackRef,
    pitch: metrics.pitch,
    max,
    stops,
    clear,
    // 쌓는 배치는 페이지가 스크롤됩니다. 벽 끝에서 더 굴린 휠은 페이지로 넘깁니다
    pageScrollAtEnds: !withPanel,
    onMoveStart: () => {
      motions.current += 1
      markMoving(true)
      swing.kick()
    },
    // 흐르는 중 분류를 다시 세지 않습니다 (S15P21E203-417) — 벽에 한 분류만 서므로 흘러도 바뀌지 않습니다
    onSettle: (start) => {
      /*
       * 분류를 바꾸며 흐르던 벽이 섰으면 옛 분류를 치웁니다. 멈춘 칸은 **치운 뒤의 벽**으로 적습니다
       * (치운 칸 수만큼 되돌린 값). 좌표를 실제로 되돌리는 일은 벽이 다시 그려진 직후(레이아웃 효과)에
       * 합니다 — 여기서 먼저 옮기면 한 장 동안 새 분류가 빈 자리에 섭니다.
       */
      const ending = passageRef.current !== null
      const at = ending ? start + passageShift.current : start
      const settle = () => {
        setView((prev) => (prev.start === at ? prev : { start: at }))
        if (ending) {
          passageEnding.current = true
          setPassage(null)
        }
      }
      // 서 있다가 곧바로 옮긴 경우(검색 · 창 크기)는 흐른 적이 없어 뗄 data-moving 도 없습니다
      if (!trackRef.current?.hasAttribute('data-moving')) {
        settle()
        return
      }
      /*
       * 새 칸 기준의 inert 를 먼저 그린 뒤(flushSync) data-moving 을 뗍니다. 거꾸로 떼면 마우스를 올린
       * 병이 커지는 효과(data-moving 이 없을 때만)가 옛 칸 기준으로 한 프레임 걸립니다.
       *
       * 마이크로태스크로 한 박자 미룹니다. 멈춤은 React 효과 안에서도 옵니다(흐르던 중에 검색어가
       * 바뀌어 맨 앞으로 옮김) — 거기서 flushSync 는 그리지 못하고 경고만 냅니다. 프레임 콜백에서 온
       * 멈춤은 그 콜백이 끝나자마자, 화면을 그리기 전에 처리됩니다. 그사이 다시 움직이기 시작했으면
       * 다음 멈춤에 맡깁니다.
       */
      const motion = motions.current
      queueMicrotask(() => {
        if (motion !== motions.current) return
        flushSync(settle)
        markMoving(false)
      })
    },
  })

  /*
   * 분류를 바꿀 때의 흐름(위 "분류를 바꿀 때"). 벽이 두 분류로 다시 그려진 직후(레이아웃 효과 — 화면에
   * 칠하기 전)에 좌표를 새 벽에 맞추고 흘려 보내고, 다 와서 옛 분류를 치운 직후에 좌표를 되돌립니다.
   * 칠하기 전에 끝내서, 벽이 바뀌는 순간에도 화면의 병은 한 픽셀도 튀지 않습니다.
   *
   * NOTE: useShelfFlow 를 부른 **뒤에** 적어야 합니다 — 흐름 엔진이 새 벽의 끝(max)을 먼저 받아야
   *   (그쪽 레이아웃 효과가 먼저 돕니다) 새 분류 첫머리까지 흘려 보낼 수 있습니다.
   */
  useLayoutEffect(() => {
    const running = passageRef.current
    passageRef.current = passage

    if (passage !== null && passage !== running) {
      const [head, tail] = layout.sections
      const leaving = passage.forward ? head : tail
      const coming = passage.forward ? tail : head
      if (!leaving || !coming) return
      // 보이던 병만 남기며 앞을 자른 만큼 당기고, 새 분류가 앞에 끼면(거꾸로) 그만큼 밉니다
      flow.rebase(leaving.start - passage.keep[0])
      passageShift.current = -coming.start
      placedCategory.current = passage.to
      flow.go(coming.start)
      return
    }

    if (passage === null && running !== null) {
      const ended = passageEnding.current
      passageEnding.current = false
      if (ended) {
        flow.rebase(passageShift.current)
        // 흐르던 중에 휠로 옛 분류 쪽으로 돌아가 섰으면 좌표가 새 벽 밖입니다 — 끝으로 붙입니다
        const at = flow.destination()
        if (at < 0 || at > max) flow.go(Math.min(Math.max(at, 0), max), true)
        return
      }
      placedCategory.current = category
      flow.go(0, true)
      return
    }

    // 흐르지 않고 갈아 끼웠습니다(움직임 줄이기 · 크기 재기 전 · 둘 다 빈 분류)
    if (passage === null && placedCategory.current !== category) {
      placedCategory.current = category
      flow.go(0, true)
    }
  }, [passage, category, flow, layout, max])

  // 검색어가 바뀌면 벽이 짧아지고 순서도 달라집니다. 맨 앞에서 다시 봅니다
  useEffect(() => {
    // 분류를 바꾸며 흐르던 중이면 그 흐름을 끊습니다 — 위 효과가 새 분류 첫머리로 옮깁니다
    if (passageRef.current !== null) {
      setPassage(null)
      return
    }
    flow.go(0, true)
  }, [flow, resetKey])

  /*
   * 고른 병이 패널에 가리지 않는 자리 밖이면 벽을 흘려 들입니다(하단 페이저로 넘길 때).
   * 보던 분류 안에서 왼쪽으로는 최소한만 옮기고(첫 병이면 이름표 기둥까지), 오른쪽으로 가거나
   * 다른 분류로 넘어가면 창 왼쪽 끝이 그 분류의 이름표보다 앞으로 나가지 않게 섭니다 — 짧은
   * 분류를 넘나들 때 두 분류의 병이 한 화면에 섞여 서고 칩이 고른 병과 다른 분류에 켜지던
   * 것을 막습니다. 구한 칸이 막힌 자리면 옮기던 쪽으로 비켜섭니다(lib.ts 의 revealItem).
   *
   * **고른 병이 바뀔 때만** 따라갑니다. 휠로 다른 분류를 훑어보는 중에 창 크기가
   * 바뀌었다고 고른 병 쪽으로 벽이 되돌아가면, 보던 자리를 잃습니다.
   *
   * 고른 병이 **다른 분류**에 있으면(페이저가 분류 끝을 넘음) 벽이 먼저 그 분류로 넘어갑니다
   * (S15P21E203-431) — 벽에 한 분류만 서게 된 뒤로, 페이저로 넘긴 병이 벽에 없는데 패널만 그 병을
   * 보이곤 했습니다. 넘어가는 동안은 벽에 새 분류의 첫머리만 서 있을 수 있어서, 병을 찾을 때까지
   * "따라갔다" 로 치지 않고 벽이 선 뒤 다시 봅니다. 처음 그릴 때(아직 따라간 병이 없음)는 넘어가지
   * 않습니다 — 들어오자마자 벽이 흐르면 누른 적 없는 움직임이 됩니다.
   */
  const revealed = useRef<number | null>(null)
  useEffect(() => {
    if (!measured || selectedId === null) return
    if (revealed.current === selectedId) return
    const home = sections.find((section) =>
      section.items.some((item) => item.shelfItemId === selectedId),
    )
    if (
      revealed.current !== null &&
      home !== undefined &&
      home.category !== category
    ) {
      onViewCategoryChange(home.category)
      return
    }
    for (const section of layout.sections) {
      const at = section.items.findIndex(
        (item) => item.shelfItemId === selectedId,
      )
      if (at < 0) continue
      revealed.current = selectedId
      const from = flow.destination()
      const next = revealItem(
        layout.sections,
        from,
        clear,
        section.start + at,
        max,
        stops,
      )
      if (next !== from) flow.go(next)
      return
    }
    // 처음 그릴 때 고른 병이 다른 분류에 있으면 여기로 옵니다 — 그 병을 따라간 것으로 칩니다
    if (revealed.current === null) revealed.current = selectedId
  }, [
    category,
    clear,
    flow,
    layout,
    max,
    measured,
    onViewCategoryChange,
    sections,
    selectedId,
    stops,
  ])

  useImperativeHandle(ref, () => ({ gust: swing.gust }), [swing])

  /*
   * 메뉴에서 분류를 고르면 — 화면이 분류를 갈고(벽은 `category` 가 바뀌면 스스로 흐릅니다) 그 분류의
   * 첫 향수를 고릅니다. 이미 서 있는 분류를 또 누르면 그 분류의 첫머리로 흘러 돌아갑니다 — 누른 것에
   * 벽이 늘 대답합니다.
   */
  const pickCategory = useCallback(
    (next: ShelfCategory) => {
      if (next === category) flow.go(0)
      else onViewCategoryChange(next)
      onPlaqueSelect?.(next)
    },
    [category, flow, onPlaqueSelect, onViewCategoryChange],
  )

  /** 화살표 한 번에 넘기는 칸 수. 절반쯤 남겨야 방금 본 병이 어디로 갔는지 이어집니다 */
  const step = Math.max(1, Math.floor(clear / 2))

  /*
   * 벽감 기준(벽감 첫 칸이 0)의 창 경계와 첫 화면 경계. −2 ~ 칸 수 + 1 로 좁혀도 벽감 안 칸의 처지는
   * 같고(lib.test.ts 의 slotView), 창에서 먼 벽감은 창이 옮겨 가도 같은 값을 받아 다시 그리지 않습니다
   * (DisplayCase 는 memo).
   */
  const caseWindow = ({ start, span }: WallSection) => {
    const local = (index: number) =>
      Math.min(span + 1, Math.max(-2, index - start))
    return {
      winFrom: local(view.start),
      winTo: local(view.start + visible),
      edgeFrom: local(view.start + whole),
      priorityFrom: local(firstScreen?.from ?? 0),
      priorityTo: local(firstScreen?.to ?? 0),
    }
  }

  return (
    <div
      ref={areaRef}
      className={cn('flex min-h-0 flex-col', className)}
      style={
        {
          '--case-h': `${metrics.caseHeight}px`,
          '--bottle-h': `${metrics.bottle}px`,
          '--pitch': `${metrics.pitch}px`,
          /*
           * 패널에 가리지 않는 폭 — **메뉴 기둥을 뺀 값**입니다. 오른쪽 화살표가 이 값에서
           * 자리를 잡는데, 창이 메뉴만큼 오른쪽으로 들어가 있어 빼지 않으면 화살표가
           * 패널 밑으로 들어갑니다 (S15P21E203-417).
           */
          '--clear-w': `${Math.max(0, metrics.clearWidth - metrics.pitch * menuSpan)}px`,
          '--panel-scale': metrics.panelScale,
          '--panel-inset': '5px',
          '--plaque-span': metrics.plaqueSpan,
          // 매달린 이름표(lib.ts 의 "매달린 이름표 자리")
          '--hang-h': `${metrics.hang}px`,
          '--cord-h': `${metrics.cord}px`,
          '--tag-w': `${metrics.tagWidth}px`,
          '--tag-h': `${metrics.tagHeight}px`,
          '--tag-scale': Number((metrics.tagWidth / TAG_WIDTH).toFixed(3)),
          // 태그 모양(lib.ts 의 "이름표 태그의 모양")
          '--tag-notch': `${tag.notch}px`,
          '--tag-inset': `${tag.inset}px`,
          '--tag-eyelet': `${tag.eyelet}px`,
          '--tag-eyelet-top': `${tag.eyeletTop}px`,
          '--tag-bead': `${tag.bead}px`,
          '--tag-shape': tag.shape,
          '--tag-edge-ring': tag.edgeRing,
          '--tag-line-ring': tag.lineRing,
          '--tag-focus-ring': tag.focusRing,
          // 옆벽의 문(lib.ts 의 doorMetrics · shelf-display.css 의 "옆벽의 문")
          '--door-shape': door.shape,
          '--door-front': `${door.front}px`,
          '--door-plane': `${door.plane}px`,
          '--door-back': `${door.back}px`,
        } as React.CSSProperties
      }
    >
      {/* 벽감 + 매달린 이름표 자리. 상세 패널이 이 위 오른쪽에 얹힙니다 */}
      <div
        className="relative shrink-0"
        style={{ height: metrics.caseHeight + metrics.hang }}
      >
        {/*
          분류 메뉴 (S15P21E203-417). 예전 이름표 기둥 자리를 그대로 씁니다 — 폭이 같은
          칸이라 벽감 왼쪽 끝이 예전과 같은 자리에 섭니다. 흐르는 창(아래 section) 밖이라
          벽이 흘러도 이 셋은 제자리에 있습니다.
        */}
        <div className="absolute top-0 left-0 flex h-[var(--case-h)] w-[calc(var(--pitch)*var(--plaque-span))] flex-col items-center gap-3.75 pr-6.25">
          {/*
            머리줄은 메뉴판과 **같은 폭**입니다. 기둥 폭을 꽉 채우면 검색창만 판보다 두 배
            넓어져 기둥 안에서 줄이 맞지 않습니다.
          */}
          {menuHeader && (
            <div className="shrink-0" style={{ width: plaque.width }}>
              {menuHeader}
            </div>
          )}
          <ShelfPlaqueMenu
            className="min-h-0 w-full flex-1"
            items={sections.map((section) => ({
              category: section.category,
              label: section.label,
              count: section.items.length,
            }))}
            value={category}
            plaque={plaque}
            hintId={plaqueHintId}
            onSelect={pickCategory}
          />
        </div>
        <section
          ref={viewportRef}
          aria-label="진열대"
          // 가로 끌기는 useShelfFlow 가 받고, 세로 끌기는 페이지 스크롤로 넘깁니다
          /*
           * 창은 **패널 왼쪽 끝에서 끊깁니다** — 예전처럼 패널 밑까지 이어지지 않습니다.
           * `--clear-w` 가 메뉴 기둥과 패널을 뺀 폭이라 그대로 창 폭이 됩니다. 벽이 패널을
           * 가리지 않으니 패널 뒤로 병이 비쳐 들 일도 없습니다.
           */
          className="group/wall absolute inset-y-0 left-[calc(var(--pitch)*var(--plaque-span))] w-[calc(var(--clear-w)_-_var(--panel-inset)_-_var(--spacing)*5)] touch-pan-y"
        >
          {/* 이름표 벽 단추의 설명. 화면에는 보이지 않고 aria-describedby 로만 읽힙니다 */}
          <span id={plaqueHintId} hidden>
            누르면 이 분류의 향수가 벽에 섭니다
          </span>
          {measured && (
            /*
              창 — 벽이 흐르는 자리. 창 밖으로 흘러간 벽은 마스크가 좌우 가장자리에서
              서서히 지웁니다. 자리 · 크기는 CSS(.shelf-window)가 정합니다 — 창 상자를
              페이드 · 이름표 자리까지 넓혀야 상자 테두리에 흰 줄이 생기지 않습니다.
            */
            <div className="shelf-window">
              {/*
                벽감 — 창에 고정입니다. 여기 한 벌만 서고 병만 그 안에서 미끄러집니다.
                그래서 DisplayCase 는 `frame={false}` 로 면을 그리지 않습니다 — 두 벌이면
                뒷벽이 겹칩니다. 자리는 창의 안쪽 상자(페이드 여백을 뺀 자리)에 맞춥니다.
              */}
              <div
                aria-hidden
                className="shelf-niche absolute top-[var(--fade)] right-[var(--fade-end)] left-[var(--fade-start)] h-[var(--case-h)]"
              >
                <div className="shelf-face shelf-niche-back" />
                <div className="shelf-face shelf-niche-light" />
                <div className="shelf-face shelf-niche-ceiling" />
                <div className="shelf-face shelf-niche-wall-left" />
                <div className="shelf-face shelf-niche-wall-right" />
                <div className="shelf-face shelf-niche-floor" />
                {/* 옆벽의 문 안 — 병 밑에 깔리는 어둠(shelf-display.css 의 "옆벽의 문") */}
                <div className="shelf-door shelf-door-left">
                  <i className="shelf-door-hole" />
                </div>
                <div className="shelf-door shelf-door-right">
                  <i className="shelf-door-hole" />
                </div>
                <div className="shelf-face shelf-niche-bevel" />
                <div className="shelf-face shelf-niche-grain" />
              </div>
              {/*
                병이 서는 자리 — 왼쪽 문 앞기둥에서 오른쪽 문 앞기둥까지 자릅니다(.shelf-track-clip).
                트랙은 그 안에서 옆벽 폭만큼 들어가 뒷벽 왼쪽 끝(접힘선)에서 시작하므로, 병이 멈추는
                칸은 접힘선에 맞고 흐를 때만 옆벽 앞을 지나 문으로 들어갑니다.
              */}
              <div className="shelf-track-clip">
                <div
                  ref={trackRef}
                  // 태그가 낮으면 적는 줄을 줄입니다(CSS 의 [data-tag-detail])
                  data-tag-detail={tag.detail}
                  // 높이는 벽감 그대로입니다 — 병 줄이 트랙 아래끝에서 섭니다. 가위 상자만 이름표 자리까지 깁니다
                  className="shelf-case flex h-[var(--case-h)] w-max will-change-transform"
                >
                  {layout.sections.map((section) => {
                    const headingId = `${idPrefix}-${section.category}`
                    return (
                      <section
                        key={section.category}
                        aria-labelledby={headingId}
                        className="flex h-full shrink-0"
                      >
                        {/* 제목은 현판이 트랙 밖으로 나가서 글자만 남깁니다 — 낭독기 전용 */}
                        <h2 id={headingId} hidden>
                          {section.label}
                        </h2>
                        <DisplayCase
                          frame={false}
                          items={section.items}
                          span={section.span}
                          selectedId={selectedId}
                          onSelect={select}
                          {...caseWindow(section)}
                          priorityId={firstScreen?.id ?? null}
                          emptyMessage={emptyMessage}
                        />
                        {/*
                          빈 벽 — 병이 가리지 않는 자리를 못 채우는 분류 뒤를 한 창까지 채웁니다. 분류를
                          바꿀 때 옛 병이 다 빠져나간 뒤에 새 병이 들어오는 간격이 됩니다.
                        */}
                        {section.gap > 0 && (
                          <div
                            aria-hidden
                            className="h-full shrink-0"
                            style={{
                              width: `calc(var(--pitch) * ${section.gap})`,
                            }}
                          />
                        )}
                      </section>
                    )
                  })}
                </div>
              </div>
              {/* 문 안 그늘 — 병 위에 얹혀 문으로 들어가는 병을 삼킵니다 */}
              <div
                aria-hidden
                className="shelf-niche-front absolute top-[var(--fade)] right-[var(--fade-end)] left-[var(--fade-start)] h-[var(--case-h)]"
              >
                <div className="shelf-door shelf-door-left">
                  <i className="shelf-door-shade" />
                </div>
                <div className="shelf-door shelf-door-right">
                  <i className="shelf-door-shade" />
                </div>
              </div>
            </div>
          )}

          {measured && max > 0 && (
            <>
              <PageArrow
                direction={-1}
                disabled={view.start <= 0}
                onClick={() => flow.go(flow.destination() - step)}
                className="left-1.25"
              />
              {/*
                오른쪽 화살표는 패널 밑이 아니라 패널 바로 왼쪽에 둡니다.

                **자리를 패널에 매지 않습니다.** `--panel-inset` 을 따라가게 두면 카드를
                옮길 때마다 화살표가 같이 움직여, 벽을 넘기는 손잡이가 자리를 못 잡습니다.
                `--clear-w` 는 패널이 벽 오른쪽 끝에 붙어 있다고 치고 센 값이라(카드
                왼쪽 끝 + `--panel-inset`) 70 을 빼 두면 화살표(35) 오른쪽 끝이 카드에서
                30 떨어져 섭니다. 70 은 화면 치수라 `--spacing` 을 곱해 적습니다.
                ⚠️ 카드를 더 왼쪽으로 옮기면(`--panel-inset` 을 키우면) 다시 겹칩니다.
              */}
              <PageArrow
                direction={1}
                disabled={view.start >= max}
                onClick={() => flow.go(flow.destination() + step)}
                className="right-1.25"
              />
            </>
          )}
        </section>

        {/*
          상세 패널 자리. 윗선은 벽감에 맞추고, 높이는 매달린 이름표 아랫선까지입니다 — 패널
          밑으로 옆 병의 이름표가 드러나지 않게 합니다.
          폭은 1920 규격에서 340px 이고 벽감 높이를 따라 0.85 배까지 줄어듭니다 — 패널
          안쪽은 ShelfDetailPanel 이 --panel-scale 로 통째로 줄입니다(lib.ts 의 shelfLayout).
          왼쪽 끝은 칸 경계에 옵니다 — 칸을 이 자리까지 나눕니다(lib.ts 의 "칸이 패널 경계에 섭니다").
          내용이 그보다 길면 스크롤 막대 없이 아래로 늘어납니다.
          창(section) 밖 형제로 둡니다 — 창 안에 두면 패널 위의 휠이 벽을 흘립니다.
          벽이 흐르는 동안에는 onMoveStart 가 이 자리에 data-moving 을 직접 걸어 패널 뒤 흐림을
          끕니다(shelf-display.css 의 .shelf-panel). 무대가 바뀌며 이름표가 바람에 들리는 동안에는
          useTagSwing 이 같은 자리에 data-gust 를 걸어 흐림을 끕니다.
        */}
        {withPanel && (
          <div
            ref={panelRef}
            // 크기를 재기 전에는 숨깁니다. 기본 벽감 높이(345)로 한 프레임 그려졌다가
            // 늘어나면 패널이 튀어 보입니다
            className={cn(
              // 벽 오른쪽 끝에 딱 붙이지 않고 한 칸 띄웁니다
              'absolute top-0 right-[var(--panel-inset)] flex flex-col',
              !measured && 'invisible',
            )}
            style={{
              width: metrics.panelWidth,
              minHeight: metrics.panelHeight,
            }}
          >
            {aside}
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * 벽 양 끝 넘김 화살표.
 *
 * 공용 `Button` 을 쓰지 않습니다. 공용 버튼은 어떤 variant 든 불투명한 채움이나
 * 테두리가 생기는데, 이건 벽 위에 얹혀 **뒤가 비쳐야** 합니다. 가려버리면 벽의
 * 그러데이션이 끊겨 진열장에 스티커를 붙인 것처럼 보입니다.
 *
 * 창 끝 병 위에 얹히는 자리라, 마우스가 있는 화면에서는 진열대에 마우스를 올렸을
 * 때만 나타납니다(휠로 흘리는 게 주된 조작입니다). 휠이 없는 터치 화면에서는 늘
 * 보이고, 키보드로 닿으면 포커스와 함께 보입니다.
 */
function PageArrow({
  direction,
  onClick,
  disabled,
  className,
}: {
  direction: 1 | -1
  onClick: () => void
  disabled: boolean
  /** 가로 자리 */
  className: string
}) {
  const next = direction === 1
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={next ? '다음 향수 보기' : '이전 향수 보기'}
      className={cn(
        'shelf-page-arrow absolute top-[calc(var(--case-h)/2)] z-[3] flex size-8.75 -translate-y-1/2',
        'items-center justify-center rounded-full',
        'transition-opacity duration-120 ease-out',
        'outline-none focus-visible:ring-2 focus-visible:ring-[var(--shelf-ink)]',
        disabled
          ? 'pointer-events-none opacity-0'
          : 'group-hover/wall:opacity-100 focus-visible:opacity-100 [@media(hover:hover)]:opacity-0',
        className,
      )}
    >
      <svg viewBox="0 0 16 16" aria-hidden className="size-3.75">
        <path
          d={next ? 'M6 3.5 10.5 8 6 12.5' : 'M10 3.5 5.5 8 10 12.5'}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  )
}
