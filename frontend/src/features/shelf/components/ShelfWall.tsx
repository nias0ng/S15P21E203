import {
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type Ref,
} from 'react'

import { cn } from '@/shared/lib/cn'

import { useShelfFlow } from '../hooks/useShelfFlow'
import { useTagSwing } from '../hooks/useTagSwing'
import {
  layoutWall,
  revealStart,
  sectionAt,
  SHELF_HANG,
  shelfMetrics,
} from '../lib'
import type { ShelfCategory, ShelfItem, ShelfSection } from '../types'

import { DisplayCase } from './DisplayCase'

export type ShelfWallHandle = {
  /** 그 분류의 이름표 벽이 창 왼쪽 끝에 오도록 흘려 보냅니다 */
  showCategory: (category: ShelfCategory) => void
}

type Props = {
  ref?: Ref<ShelfWallHandle>
  sections: ShelfSection[]
  selectedId: number | null
  onSelect: (item: ShelfItem) => void
  /** 창 가운데에 걸린 분류가 바뀔 때. 칩의 켜짐을 여기에 맞춥니다 */
  onViewCategoryChange: (category: ShelfCategory) => void
  /** 이 값이 바뀌면 벽을 맨 앞으로 되돌립니다(검색어) */
  resetKey: string
  /** 향수가 없는 분류의 벽감에 적는 말 */
  emptyMessage: string
  /** 진열장 오른쪽에 붙는 상세 패널 */
  aside: ReactNode
  className?: string
}

/**
 * 진열대 벽 (A13 재디자인) — 분류마다 벽감을 하나씩, 가로로 이어 붙인 벽입니다.
 *
 *   [보유 중 이름표][보유 중 벽감] [시향해 봄 이름표][시향해 봄 벽감] [보유 희망 …] [끝 벽]
 *
 * 휠을 굴리면 벽 전체가 좌우로 흐르고(useShelfFlow), 멈출 때는 창 양 끝에 병이 걸리지
 * 않는 자리에 섭니다. 칸 폭이 전부 같아서(이름표 벽도 한 칸) 칸 단위로 끊어 세우는
 * 것만으로 그렇게 됩니다(lib.ts 의 layoutWall).
 *
 * 예전에는 세 분류가 한 자리에 겹쳐 휠로 위아래로 바뀌었고, 한 분류 안에서는 일곱 칸
 * 창을 화살표로 세 칸씩 밀었습니다. 분류를 넘나들 때와 분류 안을 훑을 때의 조작이 달라서,
 * 휠 한 번이 무엇을 할지 화면을 보고 알 수 없었습니다. 지금은 휠이 언제나 옆으로 흐릅니다.
 *
 * ── 크기 ─────────────────────────────────────────────────
 * 벽감 높이와 한 화면의 칸 수는 이 자리의 크기에서 계산합니다(lib.ts 의 shelfMetrics).
 * 화면이 고정 한 장이라, 머리말 부제와 하단 문구를 걷어낸 세로 공간을 진열장이 씁니다.
 * 계산한 값은 CSS 변수(--case-h · --bottle-h · --pitch)로 넣고, 모양은 CSS 가 그립니다.
 *
 * ── 창 밖 병 ───────────────────────────────────────────────
 * 멈춰 있을 때 창 밖 병은 inert 로 탭 순서에서 빼고 투명하게 지웁니다. 흐르는 동안에는
 * 전부 보이게 풀어 둡니다 — 들어올 병이 창 가장자리에서 서서히 나타나야 합니다.
 *
 * ── 접근성 ─────────────────────────────────────────────
 * 휠은 **보조 수단**입니다. 칩(분류의 첫머리로)과 하단 페이저(한 병씩)가 키보드로
 * 닿고, 페이저로 고른 병이 창 밖이면 벽이 따라 흐릅니다. 넘칠 때는 벽 양 끝에
 * 화살표도 뜹니다.
 */
export function ShelfWall({
  ref,
  sections,
  selectedId,
  onSelect,
  onViewCategoryChange,
  resetKey,
  emptyMessage,
  aside,
  className,
}: Props) {
  const areaRef = useRef<HTMLDivElement>(null)
  const viewportRef = useRef<HTMLElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const idPrefix = useId()

  /*
   * 진열장 자리의 크기. 높이는 이 컴포넌트 전체(무대가 남긴 세로 공간), 폭은 패널을
   * 뺀 창의 폭입니다. 크기를 재기 전에는 벽을 그리지 않습니다 — 예전 치수로 한 번
   * 그렸다가 바꾸면 병이 한 프레임 작게 보였다 커집니다.
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
  const metrics = shelfMetrics(size.width, size.height)
  const layout = useMemo(() => layoutWall(sections), [sections])
  const max = Math.max(0, layout.total - metrics.visible)

  /** 멈춘 칸과 흐르는 중인지. 창 밖 병 · 화살표를 여기에 맞춥니다 */
  const [view, setView] = useState({ start: 0, moving: false })
  const lastCategory = useRef<ShelfCategory | null>(null)
  const kickSwing = useTagSwing(trackRef)

  const flow = useShelfFlow({
    viewport: viewportRef,
    track: trackRef,
    pitch: metrics.pitch,
    max,
    onMoveStart: () => {
      setView((prev) => ({ ...prev, moving: true }))
      kickSwing()
    },
    onMove: (position) => {
      // 창 가운데에 걸린 분류가 칩에 켜집니다
      const category = sectionAt(
        layout.sections,
        position + metrics.visible / 2,
      )?.category
      if (category && category !== lastCategory.current) {
        lastCategory.current = category
        onViewCategoryChange(category)
      }
    },
    onSettle: (start) => setView({ start, moving: false }),
  })

  // 검색어가 바뀌면 벽이 짧아지고 순서도 달라집니다. 맨 앞에서 다시 봅니다
  useEffect(() => {
    flow.go(0, true)
  }, [flow, resetKey])

  /*
   * 고른 병이 창 밖이면 벽을 최소한만 흘려 들입니다(하단 페이저로 넘길 때).
   * 왼쪽으로 들일 때 벽감의 첫 병이면 이름표 벽까지 보여 줍니다.
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
      const next = revealStart(
        from,
        metrics.visible,
        section.start + at,
        max,
        at === 0 ? 1 : 0,
      )
      if (next !== from) flow.go(next)
      return
    }
  }, [flow, layout, max, measured, metrics.visible, selectedId])

  useImperativeHandle(
    ref,
    () => ({
      showCategory: (category) => {
        const section = layout.sections.find(
          (item) => item.category === category,
        )
        if (section) flow.go(section.plaque)
      },
    }),
    [flow, layout],
  )

  const hidden = (index: number) =>
    !view.moving &&
    (index < view.start || index >= view.start + metrics.visible)

  /** 화살표 한 번에 넘기는 칸 수. 절반쯤 남겨야 방금 본 병이 어디로 갔는지 이어집니다 */
  const step = Math.max(1, Math.floor(metrics.visible / 2))

  return (
    <div
      ref={areaRef}
      className={cn('flex min-h-0 flex-col justify-center', className)}
      style={
        {
          '--case-h': `${metrics.caseHeight}px`,
          '--bottle-h': `${metrics.bottle}px`,
          '--pitch': `${metrics.pitch}px`,
        } as React.CSSProperties
      }
    >
      {/*
        진열장과 상세 패널. 둘 사이 20px 이고 윗선이 같습니다. 줄 높이는 벽감 + 매달린
        이름표 자리이고, 패널이 더 길면 패널을 따릅니다.
      */}
      <div
        className="flex items-start gap-5"
        style={{ minHeight: metrics.caseHeight + SHELF_HANG }}
      >
        <section
          ref={viewportRef}
          aria-label="진열대"
          className="group/wall relative min-w-0 flex-1 self-stretch"
        >
          {measured && (
            /*
              창 — 벽이 흐르는 자리. 창 밖으로 흘러간 벽은 마스크가 좌우 가장자리에서
              서서히 지웁니다(.shelf-window). overflow 로 자르면 경계에서 병과 그림자가
              칼로 자른 듯 끊깁니다.
            */
            <div className="shelf-window absolute inset-x-0 top-0 h-[var(--case-h)]">
              <div
                ref={trackRef}
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
                      <Plaque
                        id={headingId}
                        label={section.label}
                        count={section.items.length}
                      />
                      <DisplayCase
                        items={section.items}
                        span={section.span}
                        selectedId={selectedId}
                        onSelect={onSelect}
                        isHidden={(at) => hidden(section.start + at)}
                        emptyMessage={emptyMessage}
                      />
                    </section>
                  )
                })}
                {/* 끝 벽 — 마지막 벽감의 오른쪽 옆벽이 설 자리 */}
                <div aria-hidden className="h-full w-[var(--pitch)] shrink-0" />
              </div>
            </div>
          )}

          {measured && max > 0 && (
            <>
              <PageArrow
                direction={-1}
                disabled={view.start <= 0 && !view.moving}
                onClick={() => flow.go(flow.destination() - step)}
              />
              <PageArrow
                direction={1}
                disabled={view.start >= max && !view.moving}
                onClick={() => flow.go(flow.destination() + step)}
              />
            </>
          )}
        </section>

        {/*
          상세 패널 자리. 폭 340px(1920 규격) · 300px(1535 이하)이고, 벽감과 윗선 ·
          아랫선을 맞춥니다(패널 내용이 더 길면 늘어납니다).
        */}
        <div className="flex min-h-[var(--case-h)] w-[300px] shrink-0 flex-col 2xl:w-[340px]">
          {aside}
        </div>
      </div>
    </div>
  )
}

/**
 * 이름표 벽 — 벽감 앞에 분류 이름을 적어 두는 칸.
 *
 * 병 한 칸과 폭이 같습니다(위 설명). 칸 좌우 가장자리(--track-inset)는 이웃 벽감의
 * 옆벽이 차지해서, 글자는 그 안쪽 벽면 가운데에 섭니다. 미술관 벽의 섹션 표지처럼
 * 종이에 바로 인쇄한 모양이라 상자를 두르지 않습니다.
 */
function Plaque({
  id,
  label,
  count,
}: {
  id: string
  label: string
  count: number
}) {
  return (
    <div className="relative h-full w-[var(--pitch)] shrink-0">
      <div className="absolute inset-x-[var(--track-inset)] top-0 flex h-[var(--case-h)] flex-col items-center justify-center gap-2.5 px-2.5 text-center">
        <h2 id={id} className="text-title font-serif font-semibold">
          {label}
        </h2>
        <span aria-hidden className="shelf-hairline h-px w-5" />
        <p className="shelf-muted text-caption tabular-nums">
          <span className="sr-only">향수 </span>
          {count}
          <span className="sr-only">개</span>
        </p>
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
}: {
  direction: 1 | -1
  onClick: () => void
  disabled: boolean
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
        next ? 'right-1.25' : 'left-1.25',
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
