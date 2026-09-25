import { cn } from '@/shared/lib/cn'
import { GLASS_PANEL } from '@/shared/ui/panel'

import type { SeasonStatistic } from '../types'

import { SeasonRatingChart } from './SeasonRatingChart'

type Props = {
  seasons: SeasonStatistic[]
  isPending?: boolean
}

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
