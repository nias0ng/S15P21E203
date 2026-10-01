import { useTranslation } from 'react-i18next'

import { cn } from '@/shared/lib/cn'
import { GLASS_PANEL } from '@/shared/ui/panel'

import { RELATED_PERFUME_LIMIT } from '../api'
import type { RelatedPerfume } from '../types'

import { PerfumeGrid } from './PerfumeGrid'

type Props = {
  fromPerfumeId: number
  perfumes: RelatedPerfume[]
  isPending?: boolean
}

export function PerfumeRelated({
  fromPerfumeId,
  perfumes,
  isPending = false,
}: Props) {
  const { t } = useTranslation('perfume')

  if (!isPending && perfumes.length === 0) return null

  return (
    <section className={cn(GLASS_PANEL, 'space-y-3.75')}>
      <h2 className="text-ink text-title font-serif font-semibold">
        {t('related.title')}
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
