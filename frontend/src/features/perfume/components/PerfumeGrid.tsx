import { toPerfumeDetail } from '@/shared/config/routes'
import { EmptyState } from '@/shared/ui/EmptyState'
import { PerfumeCard } from '@/shared/ui/PerfumeCard'
import { Skeleton } from '@/shared/ui/Skeleton'

import type { PerfumeSummary } from '../types'

type PerfumeGridProps = {
  items: PerfumeSummary[]
  isPending?: boolean
  /** 결과 0건일 때 보여줄 안내. 없으면 기본 문구를 씁니다. */
  empty?: React.ReactNode
  /**
   * 0건 안내 아래에 놓을 버튼. 검색어·필터로 걸러 0건이 된 화면에서 [초기화] 를 답니다.
   * 필터 상태는 호출부가 들고 있어 여기서 만들 수 없습니다.
   */
  emptyAction?: React.ReactNode
  /** 와이어프레임 A33 은 5열, A09 검색 결과는 목록형이라 호출부에서 정합니다. */
  columns?: 4 | 5
}

/**
 * 향수 카드 그리드 (와이어프레임 A33 — 5열 2줄)
 *
 * 카드를 누르면 향수 상세(A10)로 갑니다.
 * 로딩 중에는 카드와 같은 크기의 Skeleton 을 깔아 레이아웃이 튀지 않게 합니다.
 */
export function PerfumeGrid({
  items,
  isPending = false,
  empty,
  columns = 5,
  emptyAction,
}: PerfumeGridProps) {
  const gridClass =
    columns === 5
      ? 'grid grid-cols-2 gap-3.75 sm:grid-cols-3 lg:grid-cols-5'
      : 'grid grid-cols-2 gap-3.75 sm:grid-cols-3 lg:grid-cols-4'

  if (isPending) {
    return (
      <div className={gridClass}>
        {Array.from({ length: columns * 2 }, (_, index) => (
          <Skeleton key={index} className="h-43.75" />
        ))}
      </div>
    )
  }

  if (items.length === 0) {
    return (
      empty ?? (
        <EmptyState
          title="조건에 맞는 향수가 없습니다"
          description="검색어를 바꾸거나 필터를 해제해 보세요."
          action={emptyAction}
        />
      )
    )
  }

  return (
    <ul className={gridClass}>
      {items.map((perfume) => (
        <li key={perfume.perfumeId}>
          <PerfumeCard
            name={perfume.name}
            brand={perfume.brandName}
            // 이미지가 없는 향수가 있습니다. 그때는 Thumbnail 이 빈 상자를 그립니다.
            thumbnailUrl={perfume.imageUrl}
            to={toPerfumeDetail(perfume.perfumeId)}
          />
        </li>
      ))}
    </ul>
  )
}
