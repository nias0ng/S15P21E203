import { toBrandDetail } from '@/shared/config/routes'
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
 * 브랜드를 누르면 **브랜드 상세**(`/brands/:brandId`)로 갑니다. 와이어프레임은
 * 향수 페이지에 브랜드 필터를 건 상태로 보내라고 되어 있었지만, 그러면 브랜드의
 * 이름과 소개를 놓을 자리가 없어서 상세 화면을 따로 두었습니다.
 * 향수 페이지의 `?brand=` 필터는 그대로 살아 있습니다 — 향수를 검색해서 브랜드로
 * 좁히는 흐름은 그쪽입니다.
 */
export function BrandGrid({ items, isPending = false, emptyAction }: Props) {
  const gridClass = 'grid grid-cols-2 gap-3.75 sm:grid-cols-3 lg:grid-cols-5'

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
            to={toBrandDetail(brand.brandId)}
            media={
              <Thumbnail
                src={brand.logoUrl}
                fallback="로고"
                fit="contain"
                className="h-23.75 w-full"
              />
            }
            title={brand.name}
            // 캡션은 로마자 표기입니다. 향수 개수를 적던 자리인데, 카드에서 궁금한
            // 것은 "이 브랜드가 내가 아는 그 브랜드인가" 라서 철자를 보여 줍니다.
            caption={brand.romanizedName}
          />
        </li>
      ))}
    </ul>
  )
}
