import {
  perfumeViewState,
  type PerfumeViewSource,
} from '@/shared/config/perfumeViewSource'
import { toPerfumeDetail } from '@/shared/config/routes'
import { EmptyState } from '@/shared/ui/EmptyState'
import { PerfumeCard } from '@/shared/ui/PerfumeCard'
import { Skeleton } from '@/shared/ui/Skeleton'

import type { PerfumeSummary } from '../types'

type PerfumeGridProps = {
  items: PerfumeSummary[]
  isPending?: boolean
  empty?: React.ReactNode
  /** 0건 안내 아래에 놓을 버튼. 필터 상태는 호출부가 들고 있어 여기서 만들 수 없습니다 */
  emptyAction?: React.ReactNode
  /** 와이어프레임 A33 은 5열, A09 검색 결과는 목록형이라 호출부에서 정합니다 */
  columns?: 5 | 6
  /** 검색 결과(A09)는 켜지 않습니다 — 순서가 인기가 아니라 적합도라 순위로 잘못 읽힙니다 */
  rankable?: boolean
  /** 상세에 남길 **들어온 길**(VIEW-01). 쓰는 네 화면이 다 "찾아보다 눌렀다" 라 기본값이 `SEARCH` 입니다 */
  source?: PerfumeViewSource
}

/** 향수 카드 그리드. 로딩 중에는 카드와 같은 크기의 Skeleton 을 깔아 레이아웃이 안 튑니다 */
export function PerfumeGrid({
  items,
  isPending = false,
  empty,
  columns = 5,
  rankable = false,
  source = 'SEARCH',
  emptyAction,
}: PerfumeGridProps) {
  const gridClass = {
    5: 'grid grid-cols-2 gap-3.75 sm:grid-cols-3 lg:grid-cols-5',
    6: 'grid grid-cols-2 gap-3.75 sm:grid-cols-3 lg:grid-cols-6',
  }[columns]

  if (isPending) {
    return (
      <div className={gridClass}>
        {Array.from({ length: columns * 2 }, (_, index) => (
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
            /* 브랜드는 일부러 안 넘깁니다 — 컬렉션 상세는 같은 카드에 넘겨 씁니다 */
            thumbnailUrl={perfume.imageUrl}
            to={toPerfumeDetail(perfume.perfumeId)}
            state={perfumeViewState(source)}
          />
        </li>
      ))}
    </ul>
  )
}
