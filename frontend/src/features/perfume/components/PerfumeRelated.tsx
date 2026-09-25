import { cn } from '@/shared/lib/cn'
import { GLASS_PANEL } from '@/shared/ui/panel'

import { RELATED_PERFUME_LIMIT } from '../api'
import type { RelatedPerfume } from '../types'

import { PerfumeGrid } from './PerfumeGrid'

type Props = {
  /** 지금 보고 있는 향수. 건너가는 기록에 "어디서 왔는지" 로 실립니다 */
  fromPerfumeId: number
  perfumes: RelatedPerfume[]
  isPending?: boolean
}

/** **향수가 없으면 구역을 그리지 않습니다** — 향 지도에 실린 200개 밖은 늘 빈 배열입니다 */
export function PerfumeRelated({
  fromPerfumeId,
  perfumes,
  isPending = false,
}: Props) {
  if (!isPending && perfumes.length === 0) return null

  return (
    <section className={cn(GLASS_PANEL, 'space-y-3.75')}>
      <h2 className="text-ink text-title font-serif font-semibold">
        비슷한 향수
      </h2>

      <PerfumeGrid
        items={perfumes}
        isPending={isPending}
        source="RELATED_PERFUME"
        fromPerfumeId={fromPerfumeId}
        skeletonCount={RELATED_PERFUME_LIMIT}
      />
    </section>
  )
}
