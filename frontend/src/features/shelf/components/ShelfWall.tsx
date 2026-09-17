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

import { cn } from '@/shared/lib/cn'

import { useBottlePreload } from '../hooks/useBottlePreload'
import { useShelfFlow } from '../hooks/useShelfFlow'
import { useTagSwing } from '../hooks/useTagSwing'
import {
  layoutWall,
  plaqueMetrics,
  revealItem,
  sectionAt,
  shelfLayout,
  slotView,
  TAG_WIDTH,
  tagMetrics,
  wallStops,
  type GustDirection,
  type SlotView,
  type WallSection,
} from '../lib'
import type { ShelfCategory, ShelfItem, ShelfSection } from '../types'

import { DisplayCase } from './DisplayCase'
import { ShelfPlaque, ShelfReturnPlaque } from './ShelfPlaque'

export type ShelfWallHandle = {
  /** 그 분류의 이름표 벽이 창 왼쪽 끝에 오도록 흘려 보냅니다 */
  showCategory: (category: ShelfCategory) => void
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
  selectedId: number | null
  onSelect: (item: ShelfItem) => void
  /** 가리지 않는 자리 가운데에 걸린 분류가 바뀔 때. 칩의 켜짐을 여기에 맞춥니다 */
  onViewCategoryChange: (category: ShelfCategory) => void
  /**
   * 이름표 벽을 눌렀을 때. 칩과 같은 일(그 분류의 첫 향수 고르기 + showCategory)을 하도록
   * 화면이 넘깁니다. 주지 않으면 벽만 그 분류의 첫머리로 흐릅니다. "처음으로" 현판은 첫 분류로 부릅니다.
   */
  onPlaqueSelect?: (category: ShelfCategory) => void
  /** 이 값이 바뀌면 벽을 맨 앞으로 되돌립니다(검색어) */
  resetKey: string
  /** 향수가 없는 분류의 벽감에 적는 말 */
  emptyMessage: string
  /** 벽 오른쪽 위에 얹히는 상세 패널. 주지 않으면 패널 없이 창 전체를 씁니다(쌓는 배치) */
  aside?: ReactNode
  className?: string
}

/** 첫 화면 — 크기를 잰 첫 그림의 창에 걸친 칸(벽 첫 칸부터 센 순서, to 포함)과 그때 고른 병 */
type FirstScreen = { from: number; to: number; id: number | null }

/**
 * 진열대 벽 (A13 재디자인) — 분류마다 벽감을 하나씩, 가로로 이어 붙인 벽입니다.
 *
 *   [보유 중 이름표][보유 중 벽감][빈 벽] [시향해 봄 이름표][시향해 봄 벽감] [보유 희망 …] [처음으로]
 *
 * 휠을 굴리면 벽 전체가 한 번에 한 칸씩 좌우로 흐르고(useShelfFlow), 창 왼쪽 끝이 칸 경계에
 * 자석처럼 붙어 섭니다.
 * 칸 폭이 전부 같고(이름표 벽 기둥 · 빈 벽도 칸 단위) 패널 왼쪽 끝도 칸 경계라서, 칸 단위로 끊어
 * 세우는 것만으로 창 왼쪽 끝과 패널 경계에 병이 걸리지 않습니다(lib.ts 의 "칸이 패널 경계에
 * 섭니다" · layoutWall). 이름표 벽은 두 칸 기둥이라, 기둥이 창 경계에 잘리는 칸에는 멈추지
 * 않습니다(lib.ts 의 wallStops).
 *
 * 병이 적어 가리지 않는 자리를 못 채우는 분류 뒤에는 빈 벽을 둡니다. 그 분류의 첫머리에 섰을 때
 * 다음 분류의 이름표 기둥이 패널 바로 왼쪽에 붙습니다 — 빈 벽이 한 화면씩 벌어지지 않고, 다음
 * 분류가 거기 있다는 게 보입니다. 가리지 않는 자리를 병으로 채우는 분류에서는 다음 기둥이 패널
 * 밑에 섭니다. 이름표 벽을 누르면(칩과 같이) 그 분류의 기둥이 창 왼쪽 끝에 오도록 벽이 흐릅니다.
 * 벽 끝에는 "처음으로" 현판이 패널 바로 왼쪽에 서고, 누르면 첫 분류를 고르며 맨 앞으로 흐릅니다.
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
  selectedId,
  onSelect,
  onViewCategoryChange,
  onPlaqueSelect,
  resetKey,
  emptyMessage,
  aside,
  className,
}: Props) {
  const areaRef = useRef<HTMLDivElement>(null)
  const viewportRef = useRef<HTMLElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const idPrefix = useId()
  const plaqueHintId = `${idPrefix}-plaque-hint`
  const returnHintId = `${idPrefix}-return-hint`

  /*
   * 진열장 자리의 크기. 높이는 이 컴포넌트 전체(무대가 남긴 세로 공간), 폭은 창 전체입니다.
   * 패널 폭은 재지 않고 이 크기에서 계산합니다 — 패널 폭이 벽감 높이를 따라 바뀌어서, 잰
   * 폭으로 다시 셈하면 폭과 벽감 높이가 서로를 쫓아 오갑니다. 크기를 재기 전에는 벽을
   * 그리지 않습니다 — 예전 치수로 한 번 그렸다가 바꾸면 병이 한 프레임 작게 보였다 커집니다.
   */
  const [size, setSize] = useState({ width: 0, height: 0 })
  useEffect(() => {
    const area = areaRef.current
    const viewport = viewportRef.current
    if (!area || !viewport || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => {
      const width = viewport.clientWidth
      const height = area.clientHeight
      setSize((prev) =>
        prev.width === width && prev.height === height
          ? prev
          : { width, height },
      )
    })
    observer.observe(area)
    observer.observe(viewport)
    return () => observer.disconnect()
  }, [])

  const measured = size.width > 0 && size.height > 0
  const withPanel = aside != null
  const metrics = shelfLayout(size.width, size.height, { panel: withPanel })
  const layout = useMemo(
    () => layoutWall(sections, metrics.clear, metrics.plaqueSpan),
    [sections, metrics.clear, metrics.plaqueSpan],
  )
  // 이름표 벽의 현판. 세 분류와 "처음으로" 가 같은 치수 · 모양이라 한 번만 셉니다
  const plaque = useMemo(
    () => plaqueMetrics(metrics.pitch, metrics.caseHeight, metrics.plaqueSpan),
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
  const lastPlaque = layout.sections.at(-1)?.plaque ?? 0
  const max = Math.max(0, layout.total - metrics.clear, lastPlaque)
  /** 멈출 수 있는 칸 — 이름표 벽 기둥이 창 경계에 잘리는 칸을 뺍니다(lib.ts 의 wallStops) */
  const stops = useMemo(
    () => wallStops(layout, metrics.clear, max),
    [layout, metrics.clear, max],
  )
  const first = layout.sections[0]

  /** 멈춘 칸. 창 밖 병 · 화살표를 여기에 맞춥니다. 흐르는 중인지는 상태로 들지 않습니다(위 "창 밖 병") */
  const [view, setView] = useState({ start: 0 })
  const lastCategory = useRef<ShelfCategory | null>(null)
  /** 움직이기 시작한 횟수. 멈춤을 한 박자 늦춰 그리는 사이 다시 움직이기 시작했는지 봅니다 */
  const motions = useRef(0)
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
      to: view.start + metrics.visible,
      id: selectedId,
    })
  }

  useBottlePreload(
    trackRef,
    layout.sections,
    view.start,
    metrics.clear,
    measured,
  )

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
    clear: metrics.clear,
    // 쌓는 배치는 페이지가 스크롤됩니다. 벽 끝에서 더 굴린 휠은 페이지로 넘깁니다
    pageScrollAtEnds: !withPanel,
    onMoveStart: () => {
      motions.current += 1
      markMoving(true)
      swing.kick()
    },
    onMove: (position) => {
      // 패널에 가리지 않는 자리의 가운데에 걸린 분류가 칩에 켜집니다
      const category = sectionAt(
        layout.sections,
        position + metrics.clear / 2,
      )?.category
      if (category && category !== lastCategory.current) {
        lastCategory.current = category
        onViewCategoryChange(category)
      }
    },
    onSettle: (start) => {
      const settle = () =>
        setView((prev) => (prev.start === start ? prev : { start }))
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

  // 검색어가 바뀌면 벽이 짧아지고 순서도 달라집니다. 맨 앞에서 다시 봅니다
  useEffect(() => {
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
   */
  const revealed = useRef<number | null>(null)
  useEffect(() => {
    if (!measured || selectedId === null) return
    if (revealed.current === selectedId) return
    revealed.current = selectedId
    for (const section of layout.sections) {
      const at = section.items.findIndex(
        (item) => item.shelfItemId === selectedId,
      )
      if (at < 0) continue
      const from = flow.destination()
      const next = revealItem(
        layout.sections,
        from,
        metrics.clear,
        section.start + at,
        max,
        stops,
      )
      if (next !== from) flow.go(next)
      return
    }
  }, [flow, layout, max, measured, metrics.clear, selectedId, stops])

  /** 그 분류의 이름표 벽이 창 왼쪽 끝에 오도록 흘려 보냅니다(칩 · 이름표 벽) */
  const showSection = useCallback(
    (category: ShelfCategory) => {
      const section = layout.sections.find((item) => item.category === category)
      if (section) flow.go(section.plaque)
    },
    [flow, layout],
  )

  useImperativeHandle(
    ref,
    () => ({ showCategory: showSection, gust: swing.gust }),
    [showSection, swing],
  )

  /*
   * 벽 칸 하나(벽 첫 칸부터 센 순서)의 처지(lib.ts 의 slotView). **멈춘 칸 기준**입니다 — 창 밖 칸과
   * 창 끝에 걸친 칸을 탭 순서에서 뺄 뿐, 어느 칸도 투명하게 지우지 않습니다(위 "창 밖 병").
   */
  const slotAt = (index: number): SlotView =>
    slotView(
      index,
      view.start,
      view.start + metrics.visible,
      view.start + metrics.whole,
    )

  /*
   * 이름표 벽 기둥이 탭으로 닿는가. 두 칸 중 하나라도 창 끝에 걸친 칸이면 닿지 않고, 아니면 한 칸이라도
   * 창 안일 때 닿습니다 — 현판 한 장은 반만 걸쳐도 반쯤 가려 있습니다.
   */
  const focusableAt = (column: number) => {
    const slots = Array.from({ length: layout.plaqueSpan }, (_, k) =>
      slotAt(column + k),
    )
    return (
      !slots.some((slot) => slot.edge) && slots.some((slot) => !slot.hidden)
    )
  }

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
      winTo: local(view.start + metrics.visible),
      edgeFrom: local(view.start + metrics.whole),
      priorityFrom: local(firstScreen?.from ?? 0),
      priorityTo: local(firstScreen?.to ?? 0),
    }
  }

  /** 화살표 한 번에 넘기는 칸 수. 절반쯤 남겨야 방금 본 병이 어디로 갔는지 이어집니다 */
  const step = Math.max(1, Math.floor(metrics.clear / 2))

  return (
    <div
      ref={areaRef}
      className={cn('flex min-h-0 flex-col', className)}
      style={
        {
          '--case-h': `${metrics.caseHeight}px`,
          '--bottle-h': `${metrics.bottle}px`,
          '--pitch': `${metrics.pitch}px`,
          '--clear-w': `${Math.max(0, metrics.clearWidth)}px`,
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
        } as React.CSSProperties
      }
    >
      {/* 벽감 + 매달린 이름표 자리. 상세 패널이 이 위 오른쪽에 얹힙니다 */}
      <div
        className="relative shrink-0"
        style={{ height: metrics.caseHeight + metrics.hang }}
      >
        <section
          ref={viewportRef}
          aria-label="진열대"
          // 가로 끌기는 useShelfFlow 가 받고, 세로 끌기는 페이지 스크롤로 넘깁니다
          className="group/wall absolute inset-0 touch-pan-y"
        >
          {/* 이름표 벽 단추의 설명. 화면에는 보이지 않고 aria-describedby 로만 읽힙니다 */}
          <span id={plaqueHintId} hidden>
            누르면 벽이 이 분류의 첫머리로 흐릅니다
          </span>
          {first && (
            <span id={returnHintId} hidden>
              누르면 벽이 맨 앞({first.label} 첫머리)으로 흐릅니다
            </span>
          )}
          {measured && (
            /*
              창 — 벽이 흐르는 자리. 창 밖으로 흘러간 벽은 마스크가 좌우 가장자리에서
              서서히 지웁니다. 자리 · 크기는 CSS(.shelf-window)가 정합니다 — 창 상자를
              페이드 · 이름표 자리까지 넓혀야 상자 테두리에 흰 줄이 생기지 않습니다.
            */
            <div className="shelf-window">
              <div
                ref={trackRef}
                // 태그가 낮으면 적는 줄을 줄입니다(CSS 의 [data-tag-detail])
                data-tag-detail={tag.detail}
                className="shelf-case flex h-full w-max will-change-transform"
              >
                {layout.sections.map((section) => {
                  const headingId = `${idPrefix}-${section.category}`
                  return (
                    <section
                      key={section.category}
                      aria-labelledby={headingId}
                      className="flex h-full shrink-0"
                    >
                      <ShelfPlaque
                        id={headingId}
                        category={section.category}
                        label={section.label}
                        count={section.items.length}
                        plaque={plaque}
                        hintId={plaqueHintId}
                        focusable={focusableAt(section.plaque)}
                        onShow={() =>
                          (onPlaqueSelect ?? showSection)(section.category)
                        }
                      />
                      <DisplayCase
                        items={section.items}
                        span={section.span}
                        selectedId={selectedId}
                        onSelect={select}
                        {...caseWindow(section)}
                        priorityId={firstScreen?.id ?? null}
                        emptyMessage={emptyMessage}
                      />
                      {/* 빈 벽 — 다음 분류의 이름표 기둥을 패널 바로 왼쪽으로 밀어 둡니다 */}
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
                {/*
                  "처음으로" 현판 — 예전 끝 벽 자리입니다. 기둥의 첫 33px 은 마지막 벽감의 오른쪽
                  옆벽이 쓰고, 벽 끝(max)에 서면 패널 바로 왼쪽에 붙습니다. 누르면 첫 분류의 현판을
                  누른 것과 같은 일(첫 향수 고르기 + 맨 앞으로)을 합니다. 분류가 아니라서 section ·
                  제목이 아니고, 칩 · 페이저 · 창 가운데 분류(sectionAt)에도 끼지 않습니다.
                */}
                {first && (
                  <ShelfReturnPlaque
                    label={first.label}
                    count={first.items.length}
                    plaque={plaque}
                    hintId={returnHintId}
                    focusable={focusableAt(layout.back)}
                    onShow={() =>
                      (onPlaqueSelect ?? showSection)(first.category)
                    }
                  />
                )}
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
                `--clear-w` 는 패널이 벽 오른쪽 끝에 붙어 있다고 치고 센 값이라 50 을
                빼 두면 카드가 10 물러난 지금 자리에서 5px 떨어져 섭니다.
                ⚠️ 카드를 더 왼쪽으로 옮기면(`--panel-inset` 을 키우면) 다시 겹칩니다.
              */}
              <PageArrow
                direction={1}
                disabled={view.start >= max}
                onClick={() => flow.go(flow.destination() + step)}
                className="left-[calc(var(--clear-w)-70px)]"
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
