import { cn } from '@/shared/lib/cn'

import { SCENT_REGIONS, type MapPoint } from '../types'

type Props = {
  points: MapPoint[]
  /** MAP-08 내 취향 영역. 와이어프레임의 "검은 원 = 나를 위한 추천" */
  tasteArea?: { x: number; y: number; radius: number } | null
  selectedId?: number | null
  onSelectPoint?: (point: MapPoint) => void
  /** 지도 빈 곳을 눌렀을 때 (A02 에서 모달을 닫는 데 씁니다) */
  onSelectBackground?: () => void
  zoom: number
  className?: string
  /** A06 에서는 지도를 배경으로 흐리게 깝니다 */
  dimmed?: boolean
}

/**
 * 향 지도 (와이어프레임 A01 · A02 · A03 공통 배경)
 *
 * ⚠️ 지도 라이브러리를 아직 정하지 않아 SVG 로 그린 자리표시자입니다.
 * 구역 · 포인트 · 취향 영역 · 확대 배율이 실제로 동작하므로 화면 구조와 상호작용은
 * 확인할 수 있지만, 팬 · 클러스터링 · 실제 좌표계는 라이브러리를 정한 뒤에
 * 이 컴포넌트만 갈아끼우면 됩니다. 바깥 인터페이스(props)는 그대로 두었습니다.
 *
 * 좌표는 0~100 비율이고 viewBox 도 100x100 이라 그대로 씁니다.
 */
export function ScentMap({
  points,
  tasteArea,
  selectedId,
  onSelectPoint,
  onSelectBackground,
  zoom,
  className,
  dimmed = false,
}: Props) {
  return (
    <svg
      viewBox="0 0 100 100"
      role="img"
      aria-label="향 지도"
      className={cn(
        'border-line bg-surface-card h-full w-full border',
        dimmed && 'opacity-40',
        className,
      )}
      onClick={onSelectBackground}
    >
      <g
        transform={`scale(${zoom}) translate(${(1 - 1 / zoom) * -50} ${(1 - 1 / zoom) * -50})`}
      >
        {/* 향 계열 구역 이름 — 실제 구역 경계는 라이브러리 도입 후 그립니다 */}
        {SCENT_REGIONS.map((region, index) => {
          const position = REGION_POSITIONS[index]!
          return (
            <text
              key={region.id}
              x={position.x}
              y={position.y}
              textAnchor="middle"
              className="fill-ink-muted"
              style={{ fontSize: 3.2 }}
            >
              {region.label}
            </text>
          )
        })}

        {/* 검은 원 = 나를 위한 추천 (MAP-08 · REC-12 · REC-13) */}
        {tasteArea && (
          <circle
            cx={tasteArea.x}
            cy={tasteArea.y}
            r={tasteArea.radius}
            className="fill-ink/10 stroke-ink"
            strokeWidth={0.4}
          />
        )}

        {points.map((point) => (
          <circle
            key={point.perfumeId}
            cx={point.x}
            cy={point.y}
            r={selectedId === point.perfumeId ? 2 : 1.3}
            className={cn(
              'cursor-pointer',
              selectedId === point.perfumeId
                ? 'fill-ink'
                : 'fill-slate hover:fill-ink',
            )}
            onClick={(event) => {
              // 배경 클릭 핸들러까지 올라가면 방금 연 모달이 바로 닫힙니다
              event.stopPropagation()
              onSelectPoint?.(point)
            }}
          >
            <title>
              {point.name} · {point.brand}
            </title>
          </circle>
        ))}
      </g>
    </svg>
  )
}

/** 구역 이름을 놓을 자리. 실제 구역 경계가 생기면 그 중심으로 바꿉니다. */
const REGION_POSITIONS = [
  { x: 32, y: 30 },
  { x: 68, y: 20 },
  { x: 20, y: 12 },
  { x: 82, y: 60 },
  { x: 14, y: 66 },
  { x: 60, y: 86 },
]
