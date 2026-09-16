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
  columns?: 4 | 5 | 6
  /**
   * 카드에 순위 숫자를 얹을지. 인기순으로 줄 세운 목록에서만 켜세요 —
   * 조건으로 거른 결과에 숫자가 붙으면 그 조건 안의 순위로 잘못 읽힙니다.
   */
  rankable?: boolean
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
  rankable = false,
  emptyAction,
}: PerfumeGridProps) {
  /*
    열 수가 곧 카드 크기입니다 — 카드는 폭을 격자에서 받고, 사진 칸이 3:4 라
    높이가 폭을 따라옵니다. 그래서 카드를 줄이려면 열을 늘립니다.
    1440 기준 5열 276 · 6열 228 입니다. **6열이 상한입니다** — 더 촘촘하게
    깔아 봤더니(8열 166) 병이 무엇인지 알아보기 어려웠습니다.
  */
  const gridClass = {
    4: 'grid grid-cols-2 gap-3.75 sm:grid-cols-3 lg:grid-cols-4',
    5: 'grid grid-cols-2 gap-3.75 sm:grid-cols-3 lg:grid-cols-5',
    6: 'grid grid-cols-2 gap-3.75 sm:grid-cols-3 lg:grid-cols-6',
  }[columns]

  if (isPending) {
    return (
      <div className={gridClass}>
        {/*
          카드와 같은 높이여야 자료가 도착할 때 격자가 안 튑니다. 카드는 사진 칸이
          3:4 라 폭에 따라 높이가 변하므로 고정 px 대신 같은 방식으로 셉니다 —
          사진(폭 x 4/3) + 안쪽 여백 · 사이 간격 · 글 세 줄 자리.
        */}
        {Array.from({ length: columns * 2 }, (_, index) => (
          <Skeleton key={index} className="aspect-[3/4.65] w-full" />
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
              한국어 이름을 크게, 원어 이름을 그 아래 작게 적습니다. 백엔드는 둘 다
              보내고 **무엇을 크게 적을지는 화면이 정합니다**(DTO 주석).
              한국어 이름이 없는 향수는 원어 이름이 큰 줄로 올라가고, 그때 같은 글자가
              두 줄로 겹치지 않게 거르는 일은 PerfumeCard 가 합니다.
            */
            /*
              순위는 목록에 **줄 세운 뜻이 있을 때만** 답니다. 지금 화면은 첫 쪽만
              불러오는 "최근 인기 향수" 라 화면 순서가 곧 순위입니다.
              ⚠️ 쪽 넘김이 붙으면 2쪽도 1번부터 시작합니다 — 그때는 쪽 번호를 곱해
              실제 순위로 바꾸거나, 조건을 걸어 거른 목록에서는 빼야 합니다.
            */
            rank={rankable ? index + 1 : undefined}
            name={perfume.nameKo ?? perfume.name}
            nameOriginal={perfume.name}
            /*
              브랜드는 **일부러 넘기지 않습니다.** 목록에서는 향수를 고르는 것이지
              브랜드를 고르는 것이 아니라, 줄이 늘어나 카드만 길어졌습니다.
              브랜드로 좁히는 길은 위 필터(`?brand=`)와 브랜드 화면에 따로 있습니다.
              PerfumeCard 는 brand 를 그대로 받을 수 있습니다 — 컬렉션 상세는 씁니다.
            */
            // 이미지가 없는 향수가 있습니다. 그때는 Thumbnail 이 빈 상자를 그립니다.
            thumbnailUrl={perfume.imageUrl}
            to={toPerfumeDetail(perfume.perfumeId)}
          />
        </li>
      ))}
    </ul>
  )
}
