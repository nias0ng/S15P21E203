import { ROUTES } from '@/shared/config/routes'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Skeleton } from '@/shared/ui/Skeleton'
import { Thumbnail } from '@/shared/ui/Thumbnail'
import { TileCard } from '@/shared/ui/TileCard'

import type { Brand } from '../types'

type Props = {
  items: Brand[]
  isPending?: boolean
  /** 0건 안내 아래 버튼. 검색어·정렬로 걸러 0건이 된 경우 [초기화] 를 답니다. */
  emptyAction?: React.ReactNode
}

/**
 * 브랜드 카드 그리드 (와이어프레임 A34 — 5열)
 *
 * 와이어프레임 주석: "브랜드를 누르면 그 브랜드의 향수 목록
 * (A33 향수 페이지에 브랜드 필터가 걸린 상태)". 그래서 브랜드 상세 화면이 아니라
 * 향수 페이지로 브랜드를 쿼리에 실어 보냅니다.
 */
export function BrandGrid({ items, isPending = false, emptyAction }: Props) {
  const gridClass = 'grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5'

  if (isPending) {
    return (
      <div className={gridClass}>
        {Array.from({ length: 10 }, (_, index) => (
          <Skeleton key={index} className="h-40" />
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
            to={`${ROUTES.PERFUMES}?brand=${encodeURIComponent(brand.name)}`}
            media={
              <Thumbnail
                src={brand.logoUrl}
                fallback="로고"
                fit="contain"
                className="h-24 w-full"
              />
            }
            title={brand.name}
            caption={`향수 ${brand.perfumeCount}개`}
          />
        </li>
      ))}
    </ul>
  )
}
