import { useTranslation } from 'react-i18next'

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
  const { t } = useTranslation('perfume')

  return (
    <div className="flex flex-wrap items-center justify-center gap-2.5">
      <PillFilter
        label={t('filters.rankingLabel')}
        options={RANKING_FILTERS.map(({ value }) => ({
          value,
          label: t(`filters.ranking.${value}`),
        }))}
        value={ranking}
        onChange={onRankingChange}
      />

      <span
        aria-hidden
        className="mx-1.25 hidden h-5 w-px shrink-0 bg-white/45 sm:block"
      />

      <PillFilter
        label={t('filters.genderLabel')}
        options={GENDER_FILTERS.map(({ value }) => ({
          value,
          label: t(`filters.gender.${value}`),
        }))}
        value={gender}
        onChange={onGenderChange}
      />
    </div>
  )
}
