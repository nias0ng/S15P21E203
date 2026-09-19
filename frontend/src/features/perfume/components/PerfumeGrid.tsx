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
  /** 결과 0건일 때 보여줄 안내. 없으면 기본 문구를 씁니다. */
  empty?: React.ReactNode
  /**
   * 0건 안내 아래에 놓을 버튼. 검색어·필터로 걸러 0건이 된 화면에서 [초기화] 를 답니다.
   * 필터 상태는 호출부가 들고 있어 여기서 만들 수 없습니다.
   */
  emptyAction?: React.ReactNode
  /** 와이어프레임 A33 은 5열, A09 검색 결과는 목록형이라 호출부에서 정합니다. */
  columns?: 5 | 6
  /**
   * 카드에 순위 숫자를 얹을지. 향수 목록(A33)은 늘 켜고, 검색 결과(A09)는 켜지
   * 않습니다 — 순서가 인기가 아니라 검색 적합도라 전체 순위로 잘못 읽힙니다.
   */
  rankable?: boolean
  /**
   * 이 격자를 통해 들어간 향수 상세에 남길 **들어온 길** (VIEW-01). 기본값이
   * `SEARCH` 인 것은 쓰는 네 화면이 다 "찾아보다 눌렀다" 라서입니다.
   */
  source?: PerfumeViewSource
}

/**
 * 향수 카드 그리드 (A33 — 5열 2줄). 로딩 중에는 카드와 같은 크기의 Skeleton 을
 * 깔아 레이아웃이 튀지 않게 합니다.
 */
export function PerfumeGrid({
  items,
  isPending = false,
  empty,
  columns = 5,
  rankable = false,
  source = 'SEARCH',
  emptyAction,
}: PerfumeGridProps) {
  /* 8열까지 깔아 봤더니 병이 무엇인지 알아보기 어려워 6열이 상한입니다 */
  const gridClass = {
    5: 'grid grid-cols-2 gap-3.75 sm:grid-cols-3 lg:grid-cols-5',
    6: 'grid grid-cols-2 gap-3.75 sm:grid-cols-3 lg:grid-cols-6',
  }[columns]

  if (isPending) {
    return (
      <div className={gridClass}>
        {/* 카드와 같은 높이여야 자료가 도착할 때 격자가 안 튑니다 */}
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
            /*
              **영문 이름을 크게, 한국어 이름을 그 아래 작게** 적습니다. 두 값이
              같거나 한쪽이 없을 때 거르는 일은 PerfumeCard 가 합니다.
            */
            /*
              ⚠️ 쪽 넘김이 붙으면 2쪽도 1번부터 시작합니다 — 그때는 쪽 번호를 곱해
              실제 순위로 바꿔야 합니다. 지금 순위를 다는 화면(향수 목록)은 첫 쪽만
              불러옵니다.
            */
            rank={rankable ? index + 1 : undefined}
            name={perfume.name}
            subName={perfume.nameKo}
            /* 브랜드는 일부러 안 넘깁니다 — 컬렉션 상세는 같은 카드에 넘겨 씁니다 */
            // 이미지가 없는 향수가 있습니다. 그때는 Thumbnail 이 빈 상자를 그립니다.
            thumbnailUrl={perfume.imageUrl}
            to={toPerfumeDetail(perfume.perfumeId)}
            state={perfumeViewState(source)}
          />
        </li>
      ))}
    </ul>
  )
}
