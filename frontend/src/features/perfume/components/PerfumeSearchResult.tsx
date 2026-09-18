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
   * 검색 결과 0건일 때 [향수 목록 보기] 를 눌렀을 때.
   *
   * **검색어만 비우지 않습니다.** 예전에는 그렇게 두었는데, 같은 화면에 남아
   * "검색어를 입력해주세요" 라는 또 다른 빈 화면으로 바뀔 뿐이었습니다 — 찾는 것이
   * 없어 빠져나가려는 사람을 빈 화면에서 빈 화면으로 옮긴 셈입니다.
   * 향수 목록으로 보내는 일은 화면(pages)이 합니다.
   */
  onBrowseAll?: () => void
}

/**
 * 향수 검색 결과 목록 (와이어프레임 A09 — COM-05)
 *
 * **A33 향수 목록과 같은 카드 격자를 씁니다.** 예전에는 한 줄에 하나씩 쌓는
 * 목록형이었는데, 같은 향수가 화면마다 다른 모양으로 나왔습니다 — 목록형은 사진이
 * 55px 짜리 네모라 어느 병인지 알아볼 수 없었고, 글자도 활자 스케일 밖의 임의값
 * (`text-xs` · `text-[10.5px]`)을 쓰고 있었습니다.
 * 와이어프레임에 "검색 결과 128" 처럼 총 건수가 표시됩니다.
 *
 * **순위 숫자는 붙이지 않습니다**(rankable 기본값 false). 검색 결과의 순서는
 * 인기순이 아니라 검색 적합도라, 숫자를 붙이면 "검색어와 상관없는 전체 순위" 로
 * 잘못 읽힙니다.
 *
 * **쪽을 넘길 수 있어야 합니다.** 검색은 인기 200개가 아니라 카탈로그 전체를 뒤져서
 * 수백 건이 나옵니다. 예전에는 첫 쪽만 부르면서 "검색 결과 1,284" 라고 적어 놓고
 * 스무 줄만 그렸습니다 — 숫자와 화면이 대놓고 어긋났습니다.
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
 * 향수 목록(A33)과 같은 유리판.
 *
 * **모든 갈래를 이 안에 넣습니다** — 결과가 있을 때만 판을 씌우면, 로딩 중이나
 * 0건일 때 판이 사라졌다 나타나 화면이 한 번 껌뻑입니다.
 *
 * 판 자체는 `features/perfume/perfume-display.css` 의 `.scent-glass` 가 그리고,
 * 어두운 방은 RootLayout 이 이 경로에도 깔아 줍니다.
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
