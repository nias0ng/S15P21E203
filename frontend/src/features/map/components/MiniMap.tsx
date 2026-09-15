import { cn } from '@/shared/lib/cn'

import type { MapPoint, Viewport } from '../types'

type Props = {
  points: MapPoint[]
  viewport: Viewport
  /** A06 에서 추천 향수에 번호를 붙여 표시할 때 씁니다 */
  numberedPoints?: { perfumeId: number; label: string }[]
  highlightedId?: number | null
  className?: string
}

/**
 * 미니맵 (와이어프레임 A01 · A02 · A03 · A06 공통)
 *
 * 와이어프레임 주석: "지도 전체에서 지금 보고 있는 범위를 사각형으로 표시 ·
 * 지도 계열 화면 공통". A06 에서는 지도가 흐리게 깔리고 조작이 미니맵에서 이뤄집니다.
 */
export function MiniMap({
  points,
  viewport,
  numberedPoints,
  highlightedId,
  className,
}: Props) {
  const numbers = new Map(
    (numberedPoints ?? []).map((item) => [item.perfumeId, item.label]),
  )

  return (
    <div className={cn('border-line bg-surface-card border p-2.5', className)}>
      <p className="text-ink-muted mb-1.25 text-[10.5px]">미니맵</p>
      <svg
        viewBox="0 0 100 100"
        role="img"
        aria-label="지도 전체에서 지금 보고 있는 범위"
        className="border-line bg-surface-sunken h-32.5 w-full border"
      >
        {points.map((point) => {
          const label = numbers.get(point.perfumeId)
          const highlighted = highlightedId === point.perfumeId

          return label ? (
            <g key={point.perfumeId}>
              <circle
                cx={point.x}
                cy={point.y}
                r={4}
                className={highlighted ? 'fill-ink' : 'fill-ink-muted'}
              />
              <text
                x={point.x}
                y={point.y + 1.6}
                textAnchor="middle"
                className="fill-surface"
                style={{ fontSize: 4 }}
              >
                {label}
              </text>
            </g>
          ) : (
            <circle
              key={point.perfumeId}
              cx={point.x}
              cy={point.y}
              r={1}
              className="fill-line"
            />
          )
        })}

        {/* 지금 보고 있는 범위 */}
        <rect
          x={viewport.x}
          y={viewport.y}
          width={viewport.width}
          height={viewport.height}
          fill="none"
          className="stroke-ink"
          strokeWidth={0.8}
        />
      </svg>
    </div>
  )
}
