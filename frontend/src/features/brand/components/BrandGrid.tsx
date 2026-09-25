import { toBrandDetail } from '@/shared/config/routes'
import { cn } from '@/shared/lib/cn'
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
        title="브랜드를 찾지 못했습니다"
        description="브랜드명을 다시 확인해 주세요."
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
                fallback="로고"
                fit="contain"
                className={cn(BRAND_PLATE, 'rounded-image h-40 w-full py-2.25')}
              />
            }
            title={brand.name}
            caption={brand.nameKo ?? <span aria-hidden>&nbsp;</span>}
          />
        </li>
      ))}
    </ul>
  )
}
