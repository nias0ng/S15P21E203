import { toBrandDetail } from '@/shared/config/routes'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Skeleton } from '@/shared/ui/Skeleton'
import { Thumbnail } from '@/shared/ui/Thumbnail'
import { TileCard } from '@/shared/ui/TileCard'

import type { Brand } from '../types'

type Props = {
  items: Brand[]
  isPending?: boolean
  /**
   * 불러오는 동안 깔아 둘 자리표시자 수. **한 쪽에 담는 수와 같게 주세요** —
   * 적게 주면 자료가 도착할 때 판이 아래로 늘어나며 화면이 튑니다.
   */
  skeletonCount?: number
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
 *
 * **카드는 가로로 눕습니다.** 1440 에서 5열이면 한 장이 약 265 인데, 로고 칸을
 * 80 으로 낮춰 높이가 폭의 절반쯤에서 멈춥니다. 세로로 길면 한 화면에 여섯 줄이
 * 안 들어가고, 브랜드 카드에 담기는 것이 로고와 이름 두 줄뿐이라 남는 자리가
 * 빈 띠로 보입니다.
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
