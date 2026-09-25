import { PillFilter } from '@/shared/ui/PillFilter'

import {
  GENDER_FILTERS,
  RANKING_FILTERS,
  type GenderFilter,
  type RankingFilter,
} from '../types'

type PerfumeFiltersProps = {
  ranking: RankingFilter | null
  gender: GenderFilter | null
  onRankingChange: (next: RankingFilter | null) => void
  onGenderChange: (next: GenderFilter | null) => void
}

export function PerfumeFilters({
  ranking,
  gender,
  onRankingChange,
  onGenderChange,
}: PerfumeFiltersProps) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2.5">
      <PillFilter
        label="많은 사람이 담은 기준 필터"
        options={RANKING_FILTERS}
        value={ranking}
        onChange={onRankingChange}
      />

      <span
        aria-hidden
        className="mx-1.25 hidden h-5 w-px shrink-0 bg-white/45 sm:block"
      />

      <PillFilter
        label="향의 성별"
        options={GENDER_FILTERS}
        value={gender}
        onChange={onGenderChange}
      />
    </div>
  )
}
