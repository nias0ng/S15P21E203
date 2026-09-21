import { cn } from '@/shared/lib/cn'
import { GLASS_PANEL } from '@/shared/ui/panel'

import type { SeasonStatistic } from '../types'

import { SeasonRatingChart } from './SeasonRatingChart'

type Props = {
  seasons: SeasonStatistic[]
  isPending?: boolean
}

/**
 * **읽기 전용입니다** — 계절 등록은 후기 작성 화면(DTL-16)에 있습니다. 후기가 없어도
 * 0% 도넛을 그립니다 — 숨기면 아래 구역이 위아래로 움직입니다.
 */
export function PerfumeSeasonRatings({ seasons, isPending = false }: Props) {
  return (
    <section className={cn(GLASS_PANEL, 'space-y-3.75')}>
      <h2 className="text-ink text-title font-serif font-semibold">
        계절별 평가
      </h2>
      <SeasonRatingChart seasons={isPending ? [] : seasons} />
    </section>
  )
}
