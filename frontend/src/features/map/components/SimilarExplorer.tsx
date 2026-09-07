import { EmptyState } from '@/shared/ui/EmptyState'

import type { MapPoint } from '../types'

type Props = {
  center: MapPoint
  similar: MapPoint[]
  /** 유사 향수를 누르면 그 향이 새 중심이 되어 탐색이 이어집니다 */
  onPick: (point: MapPoint) => void
}

/**
 * 유사 향수 탐색 (와이어프레임 A03 — MAP-06)
 *
 * 와이어프레임 주석:
 * - 향 계열 기준 유사 향수
 * - 유사 향수를 누르면 그 향이 새 중심이 되어 탐색이 이어진다
 * - 유사 향수가 없으면 안내 문구를 대신 표시
 * - 원 안 노드는 중간 회색, 밖은 연회색
 *
 * 중심 향수를 가운데 두고 유사 향수를 원형으로 배치합니다.
 */
export function SimilarExplorer({ center, similar, onPick }: Props) {
  if (similar.length === 0) {
    return (
      <EmptyState
        title="주변에 비슷한 향이 없습니다"
        description={`${center.name} 과 같은 향 계열에서 더 찾지 못했습니다.`}
      />
    )
  }

  return (
    <div className="border-line bg-surface-card space-y-3 border p-4">
      <h2 className="text-ink text-xs font-bold">향 계열 기준 유사 향수</h2>

      <div className="relative mx-auto aspect-square w-full max-w-80">
        {/* 탐색 반경 */}
        <div className="border-line absolute inset-0 rounded-full border border-dashed" />

        {/* 중심 향수 */}
        <div className="bg-ink absolute top-1/2 left-1/2 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full p-3 text-center">
          <span className="block truncate text-[10.5px] text-white">
            {center.name}
          </span>
        </div>

        {similar.map((point, index) => {
          // 원 위에 고르게 배치합니다
          const angle = (index / similar.length) * Math.PI * 2 - Math.PI / 2
          const radius = 42

          return (
            <button
              key={point.perfumeId}
              type="button"
              onClick={() => onPick(point)}
              title={`${point.name} · ${point.brand}`}
              className="border-line bg-fog hover:bg-slate absolute w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border p-2 transition-colors hover:text-white"
              style={{
                left: `${50 + Math.cos(angle) * radius}%`,
                top: `${50 + Math.sin(angle) * radius}%`,
              }}
            >
              <span className="block truncate text-[10px]">{point.name}</span>
            </button>
          )
        })}
      </div>

      <p className="text-ink-muted text-[10.5px]">
        유사 향수를 누르면 그 향이 새 중심이 되어 탐색이 이어집니다.
      </p>
    </div>
  )
}
