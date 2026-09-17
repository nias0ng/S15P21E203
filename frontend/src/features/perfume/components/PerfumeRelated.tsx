import { perfumeViewState } from '@/shared/config/perfumeViewSource'
import { toPerfumeDetail } from '@/shared/config/routes'
import { cn } from '@/shared/lib/cn'
import { GLASS_PANEL } from '@/shared/ui/panel'
import { PerfumeCard } from '@/shared/ui/PerfumeCard'
import { Skeleton } from '@/shared/ui/Skeleton'

import { RELATED_PERFUME_LIMIT } from '../api'
import type { RelatedPerfume } from '../types'

type Props = {
  /** 지금 보고 있는 향수. 건너가는 기록에 "어디서 왔는지" 로 실립니다 */
  fromPerfumeId: number
  perfumes: RelatedPerfume[]
  isPending?: boolean
}

/**
 * 향수 상세 ⑥ 비슷한 향수 (A10 아래)
 *
 * **향수가 없으면 구역을 그리지 않습니다.** 향 지도에 실린 200개에만 관계가 있어,
 * 나머지 향수에서는 늘 빈 배열입니다 — 빈 칸을 두면 고장으로 읽힙니다.
 *
 * 카드를 누르면 향수 상세로 건너갑니다. 이때 **어느 향수에서 왔는지**를 함께 실어
 * 조회 기록에 남깁니다(`RELATED_PERFUME`) — 향수에서 향수로 건너간 길은 검색이나
 * 커뮤니티에서 들어온 길과 뜻이 다릅니다.
 */
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

      {isPending ? (
        <div className="grid grid-cols-2 gap-3.75 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: RELATED_PERFUME_LIMIT }, (_, index) => (
            <Skeleton key={index} className="aspect-[1/1.29] w-full" />
          ))}
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-3.75 sm:grid-cols-3 lg:grid-cols-5">
          {perfumes.map((perfume) => (
            <li key={perfume.perfumeId}>
              {/* 향수 목록과 같은 약속 — 영문을 크게, 한국어를 그 아래 */}
              <PerfumeCard
                name={perfume.name}
                subName={perfume.nameKo}
                thumbnailUrl={perfume.imageUrl}
                to={toPerfumeDetail(perfume.perfumeId)}
                state={perfumeViewState('RELATED_PERFUME', fromPerfumeId)}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
