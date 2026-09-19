import { toBrandDetail } from '@/shared/config/routes'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Skeleton } from '@/shared/ui/Skeleton'
import { Thumbnail } from '@/shared/ui/Thumbnail'
import { TileCard } from '@/shared/ui/TileCard'

import type { Brand } from '../types'

type Props = {
  items: Brand[]
  isPending?: boolean
  /** 자리표시자 수. **한 쪽에 담는 수와 같게** 주지 않으면 화면이 튑니다 */
  skeletonCount?: number
  /** 0건 안내 아래 버튼. 검색어·정렬로 걸러 0건이 된 경우 [초기화] 를 답니다. */
  emptyAction?: React.ReactNode
}

/**
 * 브랜드 카드 그리드 (A34 — 5열)
 *
 * 브랜드를 누르면 **브랜드 상세**로 갑니다. 와이어프레임은 향수 페이지에 필터를
 * 건 상태로 보내라고 했지만 브랜드의 이름과 소개를 놓을 자리가 없었습니다 —
 * `?brand=` 필터는 그대로 살아 있습니다.
 */
export function BrandGrid({
  items,
  isPending = false,
  skeletonCount = 10,
  emptyAction,
}: Props) {
  const gridClass = 'grid grid-cols-2 gap-3.75 sm:grid-cols-3 lg:grid-cols-5'

  if (isPending) {
    return (
      <div className={gridClass}>
        {Array.from({ length: skeletonCount }, (_, index) => (
          // 카드 한 장의 높이(로고 80 + 이름 두 줄 + 안쪽 여백 = 162)와 맞춥니다
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
                className="h-20 w-full"
              />
            }
            title={brand.nameKo ?? brand.name}
            /*
              캡션은 영문 표기입니다. 향수 개수를 적던 자리인데, 카드에서 궁금한
              것은 "이 브랜드가 내가 아는 그 브랜드인가" 라서 철자를 보여 줍니다.

              한국어 이름이 없는 브랜드는 제목이 이미 영문이라 적을 것이 없는데,
              **줄자리는 남겨 둡니다.** 안 남기면 그 카드만 한 줄 짧아져서 격자에
              키가 다른 카드가 섞입니다(브랜드 7,793개 중 68개가 이 경우입니다).
              낭독기는 빈 줄을 건너뜁니다.
            */
            caption={
              brand.nameKo ? brand.name : <span aria-hidden>&nbsp;</span>
            }
          />
        </li>
      ))}
    </ul>
  )
}
