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
   * 카드에 순위 숫자를 얹을지.
   *
   * 향수 목록(A33)은 **필터를 걸든 안 걸든 켭니다.** `보유` · `희망` · `조회` 를
   * 고르면 백엔드가 "기록이 많은 순" 으로 줄 세워 주고, 성별은 그 순위 안에서
   * 걸러 내기만 하므로 `보유 + 여성` 의 1번도 그 조건 안의 1위입니다.
   *
   * 검색 결과(A09)는 켜지 않습니다 — 순서가 인기가 아니라 검색 적합도라,
   * 숫자가 붙으면 "검색어와 상관없는 전체 순위" 로 잘못 읽힙니다.
   */
  rankable?: boolean
  /**
   * 이 격자를 통해 들어간 향수 상세에 남길 **들어온 길** (VIEW-01).
   *
   * 격자는 자기가 어느 화면에 놓였는지 모릅니다 — 향수 목록 · 검색 결과 · 브랜드 ·
   * 노트가 다 같은 격자를 씁니다. 기본값이 `SEARCH` 인 것은 넷 다 "찾아보다 눌렀다" 에
   * 해당해서입니다. 다른 뜻이 필요한 화면만 넘기세요.
   */
  source?: PerfumeViewSource
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
  source = 'SEARCH',
  emptyAction,
}: PerfumeGridProps) {
  /*
    열 수가 곧 카드 크기입니다 — 카드는 폭을 격자에서 받고, 사진 칸이 3:4 라
    높이가 폭을 따라옵니다. 그래서 카드를 줄이려면 열을 늘립니다.
    1440 기준 5열 276 · 6열 228 입니다. **6열이 상한입니다** — 더 촘촘하게
    깔아 봤더니(8열 166) 병이 무엇인지 알아보기 어려웠습니다.
  */
  const gridClass = {
    5: 'grid grid-cols-2 gap-3.75 sm:grid-cols-3 lg:grid-cols-5',
    6: 'grid grid-cols-2 gap-3.75 sm:grid-cols-3 lg:grid-cols-6',
  }[columns]

  if (isPending) {
    return (
      <div className={gridClass}>
        {/*
          카드와 같은 높이여야 자료가 도착할 때 격자가 안 튑니다. 카드는 사진 칸이
          정사각이라 폭에 따라 높이가 변하므로 고정 px 대신 같은 방식으로 셉니다 —
          사진(폭과 같은 높이) + 안쪽 여백 · 사이 간격 · 이름 두 줄 자리.
        */}
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
              **영문 이름을 크게, 한국어 이름을 그 아래 작게** 적습니다. 백엔드는 둘 다
              보내고 무엇을 크게 적을지는 화면이 정합니다(DTO 주석). 영문 이름은 병에
              적힌 글자라 사진과 바로 맞춰 읽히고, 한국어 이름이 그 아래에서 "무슨
              향수인지" 를 받아 줍니다.

              한국어 이름이 없는 향수는 아랫줄이 비고, 두 값이 같을 때 같은 글자가
              두 줄로 겹치지 않게 거르는 일은 PerfumeCard 가 합니다.
            */
            /*
              ⚠️ 쪽 넘김이 붙으면 2쪽도 1번부터 시작합니다 — 그때는 쪽 번호를 곱해
              실제 순위로 바꿔야 합니다. 지금 순위를 다는 화면(향수 목록)은 첫 쪽만
              불러옵니다.
            */
            rank={rankable ? index + 1 : undefined}
            name={perfume.name}
            subName={perfume.nameKo}
            /*
              브랜드는 **일부러 넘기지 않습니다.** 목록에서는 향수를 고르는 것이지
              브랜드를 고르는 것이 아니라, 줄이 늘어나 카드만 길어졌습니다.
              브랜드로 좁히는 길은 위 필터(`?brand=`)와 브랜드 화면에 따로 있습니다.
              PerfumeCard 는 brand 를 그대로 받을 수 있습니다 — 컬렉션 상세는 씁니다.
            */
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
