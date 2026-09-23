import { toBrandDetail } from '@/shared/config/routes'
import { cn } from '@/shared/lib/cn'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Skeleton } from '@/shared/ui/Skeleton'
import { Thumbnail } from '@/shared/ui/Thumbnail'
import { TileCard } from '@/shared/ui/TileCard'

import { BRAND_PLATE } from '../plate'
import type { Brand } from '../types'

type Props = {
  items: Brand[]
  isPending?: boolean
  /** 한 쪽에 담는 수와 같게 주지 않으면 화면이 튑니다 */
  skeletonCount?: number
  emptyAction?: React.ReactNode
}

/** 브랜드 카드 그리드 (A34 — 5열) */
export function BrandGrid({
  items,
  isPending = false,
  skeletonCount = 10,
  emptyAction,
}: Props) {
  /* NOTE: 열 수는 향수 · 노트 격자와 같은 값입니다 — 여기만 바꾸면 카드 폭이 화면마다 달라집니다 */
  const gridClass = 'grid grid-cols-2 gap-3.75 sm:grid-cols-3 lg:grid-cols-5'

  if (isPending) {
    return (
      <div className={gridClass}>
        {Array.from({ length: skeletonCount }, (_, index) => (
          // 카드 한 장과 비슷한 높이 — 로고(h-40) + 제목 · 캡션 + 안쪽 여백입니다
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
    <ul className={gridClass}>
      {items.map((brand) => (
        <li key={brand.brandId}>
          <TileCard
            to={toBrandDetail(brand.brandId)}
            media={
              <Thumbnail
                src={brand.logoUrl}
                fallback="로고"
                fit="contain"
                className={cn(BRAND_PLATE, 'rounded-image h-40 w-full')}
              />
            }
            title={brand.name}
            /* 한국어 이름이 없어도 줄자리는 남깁니다 — 안 남기면 그 카드만 한 줄 짧아집니다 */
            caption={brand.nameKo ?? <span aria-hidden>&nbsp;</span>}
          />
        </li>
      ))}
    </ul>
  )
}
