import {
  perfumeViewState,
  type PerfumeViewSource,
} from '@/shared/config/perfumeViewSource'
import { toPerfumeDetail } from '@/shared/config/routes'
import { cn } from '@/shared/lib/cn'
import { CARD_GRID } from '@/shared/ui/cardGrid'
import { EmptyState } from '@/shared/ui/EmptyState'
import { PerfumeCard } from '@/shared/ui/PerfumeCard'
import { Skeleton } from '@/shared/ui/Skeleton'

import type { PerfumeSummary } from '../types'

type PerfumeGridProps = {
  items: Pick<PerfumeSummary, 'perfumeId' | 'name' | 'nameKo' | 'imageUrl'>[]
  isPending?: boolean
  empty?: React.ReactNode
  /** 0건 안내 아래에 놓을 버튼. 필터 상태는 호출부가 들고 있어 여기서 만들 수 없습니다 */
  emptyAction?: React.ReactNode
  /** 와이어프레임 A33 은 5열, A09 검색 결과는 목록형이라 호출부에서 정합니다 */
  columns?: 5 | 6
  /** 검색 결과(A09)는 켜지 않습니다 — 순서가 인기가 아니라 적합도라 순위로 잘못 읽힙니다 */
  rankable?: boolean
  /** 상세에 남길 **들어온 길**(VIEW-01). 목록 · 브랜드 · 노트 화면이 다 "찾아보다 눌렀다" 라 기본값이 `SEARCH` 입니다 */
  source?: PerfumeViewSource
  /** 다른 향수 상세에서 건너갈 때(`RELATED_PERFUME`) 지금 보고 있는 향수 */
  fromPerfumeId?: number
  /** 불러오는 동안 깔 자리 수. 기본은 두 줄입니다 */
  skeletonCount?: number
}

/** 향수 카드 그리드. 로딩 중에는 카드와 같은 크기의 Skeleton 을 깔아 레이아웃이 안 튑니다 */
export function PerfumeGrid({
  items,
  isPending = false,
  empty,
  columns = 5,
  rankable = false,
  source = 'SEARCH',
  fromPerfumeId,
  skeletonCount = columns * 2,
  emptyAction,
}: PerfumeGridProps) {
  const gridClass = columns === 6 ? cn(CARD_GRID, 'lg:grid-cols-6') : CARD_GRID

  if (isPending) {
    return (
      <div className={gridClass}>
        {Array.from({ length: skeletonCount }, (_, index) => (
          <Skeleton key={index} className="aspect-[1/1.29] w-full" />
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
            /* NOTE: 쪽 넘김이 붙으면 2쪽도 1번부터 시작합니다 — 그때는 쪽 번호를 곱해야 합니다 */
            rank={rankable ? index + 1 : undefined}
            name={perfume.name}
            subName={perfume.nameKo}
            thumbnailUrl={perfume.imageUrl}
            to={toPerfumeDetail(perfume.perfumeId)}
            state={perfumeViewState(source, fromPerfumeId)}
          />
        </li>
      ))}
    </ul>
  )
}
