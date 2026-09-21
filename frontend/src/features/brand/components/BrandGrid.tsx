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
 * 브랜드 카드 그리드 (A34 — 5열). 브랜드를 누르면 **브랜드 상세**로 갑니다 —
 * 와이어프레임의 `?brand=` 필터 링크도 그대로 살아 있습니다.
 */
export function BrandGrid({
  items,
  isPending = false,
  skeletonCount = 10,
  emptyAction,
}: Props) {
  /*
    ⚠️ 열 수는 향수 · 노트 격자와 **같은 값입니다.** 여기만 바꾸면 화면을 오갈 때
    카드 폭이 움직입니다 (S15P21E203-363 은 가로를 그대로 두고 세로만 늘렸습니다).
  */
  const gridClass = 'grid grid-cols-2 gap-3.75 sm:grid-cols-3 lg:grid-cols-5'

  if (isPending) {
    return (
      <div className={gridClass}>
        {Array.from({ length: skeletonCount }, (_, index) => (
          // 카드 한 장의 높이(로고 160 + 이름 두 줄 + 안쪽 여백 = 242)와 맞춥니다
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
              /*
                카드 높이를 1.5 배로 늘립니다 (S15P21E203-363). 가로는 격자가
                쥐고 있어 그대로이므로, 늘어나는 자리는 로고 칸뿐입니다 —
                80 → 160 이면 카드가 162 → 242 로 1.49 배입니다
                (로고 밖 82 = 안쪽 여백 20 + 사이 10 + 이름 두 줄 52 는 그대로).

                ⚠️ `contain` 이라 로고가 커지는 것은 **세로로 긴 로고뿐**입니다.
                가로로 긴 낱말 로고는 이미 폭에 걸려 있어 크기가 그대로이고 위아래
                여백만 넓어집니다.
              */
              <Thumbnail
                src={brand.logoUrl}
                fallback="로고"
                fit="contain"
                className="h-40 w-full"
              />
            }
            title={brand.nameKo ?? brand.name}
            /*
              한국어 이름이 없는 브랜드는 적을 것이 없어도 **줄자리는 남깁니다** —
              안 남기면 그 카드만 한 줄 짧아집니다(7,793개 중 68개).
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
