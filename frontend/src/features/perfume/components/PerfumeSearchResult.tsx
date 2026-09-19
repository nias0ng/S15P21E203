import { useQuery } from '@tanstack/react-query'

import { Button } from '@/shared/ui/Button'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Pagination } from '@/shared/ui/Pagination'
import { GLASS_PANEL } from '@/shared/ui/panel'

import { perfumeListQuery } from '../queries'

import { PerfumeGrid } from './PerfumeGrid'

/** 향수 목록(A33)과 같은 수. 6열이라 다섯 줄로 떨어집니다. 백엔드 최대는 100 입니다. */
const PAGE_SIZE = 30

type Props = {
  keyword: string
  /** 0부터 시작합니다 (백엔드와 같습니다) */
  page: number
  onPageChange: (page: number) => void
  /**
   * 검색 결과 0건에서 [향수 목록 보기]. **검색어만 비우면** 같은 화면의 또 다른
   * 빈 화면으로 바뀔 뿐이라, 향수 목록으로 보냅니다(그 일은 화면이 합니다).
   */
  onBrowseAll?: () => void
}

/**
 * 향수 검색 결과 목록 (A09 — COM-05). A33 향수 목록과 같은 카드 격자입니다.
 *
 * **순위 숫자는 안 붙입니다**(`rankable` 기본 false) — 검색 결과의 순서는 인기순이
 * 아니라 적합도라, 숫자가 붙으면 전체 순위로 잘못 읽힙니다.
 *
 * **쪽을 넘길 수 있어야 합니다.** 예전에는 첫 쪽만 부르면서 "검색 결과 1,284" 라고
 * 적어 놓고 스무 줄만 그려, 숫자와 화면이 어긋났습니다.
 */
export function PerfumeSearchResult({
  keyword,
  page,
  onPageChange,
  onBrowseAll,
}: Props) {
  const { data, isPending, isError, refetch } = useQuery({
    ...perfumeListQuery({ keyword, page, size: PAGE_SIZE }),
    // 검색어가 없으면 요청하지 않습니다
    enabled: keyword.trim().length > 0,
  })

  if (!keyword.trim()) {
    return (
      <EmptyState
        title="검색어를 입력해주세요"
        description="향수명 또는 브랜드명으로 검색합니다."
      />
    )
  }

  // 자리 잡기도 격자에 맡깁니다 — 카드와 같은 크기여야 자료가 도착할 때 안 튑니다
  if (isPending)
    return (
      <Board>
        <PerfumeGrid items={[]} isPending columns={6} />
      </Board>
    )

  if (isError) {
    return (
      <Board>
        <EmptyState
          title="검색에 실패했습니다"
          description="다시 시도해주세요."
          action={
            <Button variant="outline" onClick={() => refetch()}>
              다시 시도
            </Button>
          }
        />
      </Board>
    )
  }

  // 건수로 판단합니다. 줄 수로 보면 범위를 넘은 쪽(주소를 직접 고친 경우)에서도
  // "검색 결과가 없습니다" 가 떠서, 결과가 있는데 없다고 말하게 됩니다.
  if (data.totalElements === 0) {
    return (
      <Board>
        <EmptyState
          title="검색 결과가 없습니다"
          description={`'${keyword}' 와 일치하는 향수를 찾지 못했습니다.`}
          action={
            onBrowseAll && (
              <Button variant="outline" onClick={onBrowseAll}>
                향수 목록 보기
              </Button>
            )
          }
        />
      </Board>
    )
  }

  return (
    <Board
      heading={
        <>
          검색 결과{' '}
          <span className="text-ink-muted text-caption font-normal">
            {data.totalElements}개
          </span>
        </>
      }
    >
      {/* 범위를 넘은 쪽. 앞쪽으로 돌아갈 수 있게 아래 쪽 번호는 그대로 둡니다 */}
      {data.perfumes.length === 0 && (
        <EmptyState
          title="이 쪽에는 결과가 없습니다"
          description="앞쪽으로 돌아가 주세요."
        />
      )}

      {data.perfumes.length > 0 && (
        <PerfumeGrid items={data.perfumes} columns={6} />
      )}

      <Pagination
        className="mt-6.25"
        label="검색 결과 페이지"
        page={page}
        size={PAGE_SIZE}
        totalElements={data.totalElements}
        onPageChange={onPageChange}
      />
    </Board>
  )
}

/**
 * 유리판. **모든 갈래를 이 안에 넣습니다** — 결과가 있을 때만 씌우면 로딩 중이나
 * 0건일 때 판이 사라졌다 나타나 화면이 껌뻑입니다.
 */
function Board({
  heading,
  children,
}: {
  heading?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className={GLASS_PANEL}>
      {heading && (
        <h2 className="text-ink mb-6.25 font-serif text-2xl">{heading}</h2>
      )}
      {children}
    </section>
  )
}
