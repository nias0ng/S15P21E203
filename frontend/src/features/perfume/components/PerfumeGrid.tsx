import { useTranslation } from 'react-i18next'

import {
  perfumeViewState,
  type PerfumeViewSource,
} from '@/shared/config/perfumeViewSource'
import { toPerfumeDetail } from '@/shared/config/routes'
import { cn } from '@/shared/lib/cn'
import { useLocale } from '@/shared/store/localeStore'
import { CARD_GRID } from '@/shared/ui/cardGrid'
import { EmptyState } from '@/shared/ui/EmptyState'
import { PerfumeCard } from '@/shared/ui/PerfumeCard'
import { Skeleton } from '@/shared/ui/Skeleton'

import type { PerfumeSummary } from '../types'

type PerfumeGridProps = {
  items: Pick<PerfumeSummary, 'perfumeId' | 'name' | 'nameKo' | 'imageUrl'>[]
  isPending?: boolean
  empty?: React.ReactNode
  emptyAction?: React.ReactNode
  columns?: 5 | 6
  rankable?: boolean
  source?: PerfumeViewSource
  fromPerfumeId?: number
  skeletonCount?: number
}

export function PerfumeGrid({
  items,
  isPending = false,
  empty,
  columns = 5,
  rankable = false,
  source = 'SEARCH',
  fromPerfumeId,
  skeletonCount = columns * 2,
  emptyAction,
}: PerfumeGridProps) {
  const { t } = useTranslation('perfume')
  const locale = useLocale()
  const gridClass = columns === 6 ? cn(CARD_GRID, 'lg:grid-cols-6') : CARD_GRID

  if (isPending) {
    return (
      <div className={gridClass}>
        {Array.from({ length: skeletonCount }, (_, index) => (
          <Skeleton key={index} className="aspect-[1/1.29] w-full" />
        ))}
      </div>
    )
  }

  if (items.length === 0) {
    return (
      empty ?? (
        <EmptyState
          title={t('grid.emptyTitle')}
          description={t('grid.emptyDescription')}
          action={emptyAction}
        />
      )
    )
  }

  return (
    <ul className={gridClass}>
      {items.map((perfume, index) => (
        <li key={perfume.perfumeId}>
          <PerfumeCard
            /* NOTE: 쪽 넘김이 붙으면 2쪽도 1번부터 시작합니다 — 그때는 쪽 번호를 곱해야 합니다 */
            rank={rankable ? index + 1 : undefined}
            name={perfume.name}
            // 영어 화면은 원래 이름만 둡니다 — 한국어 이름을 받쳐 적을 까닭이 없습니다
            subName={locale === 'en' ? null : perfume.nameKo}
            thumbnailUrl={perfume.imageUrl}
            to={toPerfumeDetail(perfume.perfumeId)}
            state={perfumeViewState(source, fromPerfumeId)}
          />
        </li>
      ))}
    </ul>
  )
}
