import { useTranslation } from 'react-i18next'

import { toBrandDetail } from '@/shared/config/routes'
import { cn } from '@/shared/lib/cn'
import { useLocale } from '@/shared/store/localeStore'
import { CARD_GRID } from '@/shared/ui/cardGrid'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Skeleton } from '@/shared/ui/Skeleton'
import { Thumbnail } from '@/shared/ui/Thumbnail'
import { TileCard } from '@/shared/ui/TileCard'

import { BRAND_PLATE } from '../plate'
import type { Brand } from '../types'

type Props = {
  items: Brand[]
  isPending?: boolean
  skeletonCount?: number
  emptyAction?: React.ReactNode
}

export function BrandGrid({
  items,
  isPending = false,
  skeletonCount = 10,
  emptyAction,
}: Props) {
  const { t } = useTranslation('brand')
  const locale = useLocale()

  if (isPending) {
    return (
      <div className={CARD_GRID}>
        {Array.from({ length: skeletonCount }, (_, index) => (
          <Skeleton key={index} className="h-60" />
        ))}
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <EmptyState
        title={t('grid.emptyTitle')}
        description={t('grid.emptyDescription')}
        action={emptyAction}
      />
    )
  }

  return (
    <ul className={CARD_GRID}>
      {items.map((brand) => (
        <li key={brand.brandId}>
          <TileCard
            to={toBrandDetail(brand.brandId)}
            media={
              <Thumbnail
                src={brand.logoUrl}
                fallback={t('grid.logoFallback')}
                fit="contain"
                className={cn(BRAND_PLATE, 'rounded-image h-40 w-full py-2.25')}
              />
            }
            title={brand.name}
            // 캡션 줄은 비어도 자리를 지켜 타일 높이가 맞습니다. 영어 화면은 원래 이름만 둡니다
            caption={
              (locale === 'en' ? null : brand.nameKo) ?? (
                <span aria-hidden>&nbsp;</span>
              )
            }
          />
        </li>
      ))}
    </ul>
  )
}
