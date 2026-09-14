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
  /** 0건 안내 아래 버튼. 필터 상태는 호출부가 들고 있어 여기서 만들 수 없습니다 */
  emptyAction?: React.ReactNode
  /** 와이어프레임 A33 은 5열, A09 검색 결과는 목록형이라 호출부에서 정합니다. */
  columns?: 4 | 5
  /**
   * 카드 좌상단 번호. 순위가 아니라 **서버가 돌려준 순서**라, 순서 자체가 뜻을 갖는
   * 목록에서만 켭니다 — 걸러 본 목록에 붙으면 없는 순위처럼 읽힙니다.
   */
  numbered?: boolean
}

/** 향수 카드 그리드 (와이어프레임 A33 — 5열 2줄). 누르면 향수 상세(A10)로 갑니다 */
export function PerfumeGrid({
  items,
  isPending = false,
  empty,
  columns = 5,
  numbered = false,
  emptyAction,
}: PerfumeGridProps) {
  const gridClass =
    columns === 5
      ? 'grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5'
      : 'grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4'

  if (isPending) {
    return (
      <div className={gridClass}>
        {Array.from({ length: columns * 2 }, (_, index) => (
          // 카드 실물 높이와 맞춰야 로드된 순간 화면이 안 튑니다
          <Skeleton key={index} className="rounded-panel h-64" />
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
      {items.map((perfume, index) => (
        <li key={perfume.perfumeId}>
          <PerfumeCard
            name={perfume.name}
            brand={perfume.brandName}
            // ⚠️ 백엔드가 아직 안 내려주는 필드입니다. 없으면 자리표시자가 나옵니다.
            thumbnailUrl={perfume.imageUrl}
            // 서버가 돌려준 순서. 순위 필드가 아니라 "이 목록의 몇 번째" 입니다.
            rank={numbered ? index + 1 : undefined}
            to={toPerfumeDetail(perfume.perfumeId)}
          />
        </li>
      ))}
    </ul>
  )
}
