import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router'

import {
  perfumeListQuery,
  PerfumeFilters,
  PerfumeGrid,
  readGenderFilter,
  readRankingFilter,
} from '@/features/perfume'
import { useDiveReady } from '@/shared/hooks/useDiveReady'
import { readPage, withQueryParams, writePage } from '@/shared/lib/queryParams'
import { Button } from '@/shared/ui/Button'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Pagination } from '@/shared/ui/Pagination'
import { GLASS_PANEL } from '@/shared/ui/panel'
import { SearchField, SEARCH_FIELD_LIST_WIDTH } from '@/shared/ui/SearchField'

/** 한 화면에 깔 향수 수(백엔드 기본값은 20). 6열이라 30이면 다섯 줄로 떨어집니다 */
const PAGE_SIZE = 30

/**
 * 향수 (A33 — 상단 메뉴 [향수] 목적지) + 검색 결과 (A09 — COM-05). 검색어 `?keyword=`
 * 는 필터와 AND 로 묶입니다.
 *
 * NOTE: 쪽 넘김은 검색할 때만이고, 검색어가 없으면 첫 30개가 전부입니다 — 목록은 무한
 * 스크롤로 갈 자리입니다(docs/UI-명세.md §6). 검색 중에는 순서가 인기가 아니라 검색
 * 적합도라 순위 숫자를 끕니다.
 */
export default function PerfumeListPage() {
  const [searchParams, setSearchParams] = useSearchParams()

  /*
    NOTE: 필터는 `useState` 가 아니라 주소에 둡니다 — 상세로 갔다 오면 이 화면이
    새로 만들어져 `useState` 는 처음 값으로 돌아갑니다. 값은 사람이 고쳐 쓸 수
    있으므로 읽을 때 거릅니다.
  */
  const ranking = readRankingFilter(searchParams.get('ranking'))
  const gender = readGenderFilter(searchParams.get('gender'))
  const keyword = (searchParams.get('keyword') ?? '').trim()
  const searching = keyword.length > 0
  const page = readPage(searchParams)

  const { data, isPending, isError, refetch } = useQuery(
    perfumeListQuery({
      keyword: searching ? keyword : undefined,
      ranking: ranking ?? undefined,
      gender: gender ?? undefined,
      page: searching ? page : undefined,
      size: PAGE_SIZE,
    }),
  )

  const items = data?.perfumes ?? []

  // 잠수로 들어왔으면 커튼이 이 신호를 기다립니다 — 목록이 칠해지면 다 선 것입니다
  useDiveReady(!isPending)

  const filtered = ranking !== null || gender !== null

  // 쪽도 함께 처음으로 돌립니다 — 3쪽을 보다 조건을 켜면 결과가 줄어 그 쪽이 빕니다
  const setFilter = (key: 'ranking' | 'gender', value: string | null) => {
    setSearchParams(withQueryParams(searchParams, { [key]: value, page: null }))
  }

  // 걸러서 0건일 때만 [초기화] 입니다 — 원래 자료가 없으면 눌러도 달라지지 않습니다
  const resetButton = (filtered || searching) && (
    <Button
      variant="outline"
      onClick={() => {
        setSearchParams(
          withQueryParams(searchParams, {
            ranking: null,
            gender: null,
            keyword: null,
            page: null,
          }),
        )
      }}
    >
      초기화
    </Button>
  )

  // 0건인지는 그린 줄 수가 아니라 건수로 가릅니다 — 범위를 넘은 쪽에서도 "결과가
  // 없습니다" 가 떠서 결과가 있는데 없다고 말하게 됩니다
  const searchEmpty =
    !searching || !data ? undefined : data.totalElements > 0 ? (
      <EmptyState
        title="이 쪽에는 결과가 없습니다"
        description="앞쪽으로 돌아가 주세요."
      />
    ) : (
      <EmptyState
        title="검색 결과가 없습니다"
        description={`'${keyword}' 와 일치하는 향수를 찾지 못했습니다.`}
        action={resetButton}
      />
    )

  const heading = searching
    ? '검색 결과'
    : filtered
      ? '조건에 맞는 향수'
      : '최근 인기 향수'

  // 검색은 전체 건수, 목록은 그린 개수입니다 — 목록은 첫 30개만 불러서 전체 건수를
  // 적으면 "1,284개" 라 써 놓고 서른 장을 그리게 됩니다
  const count = searching
    ? (data?.totalElements ?? null)
    : items.length > 0
      ? items.length
      : null

  return (
    <div className="space-y-3.75">
      <h1 className="sr-only">향수</h1>

      {/* 헤더에 검색창이 없고 검색은 각 페이지 안에 있다는 와이어프레임 규칙 */}
      <SearchField
        className={SEARCH_FIELD_LIST_WIDTH}
        label="향수명 또는 브랜드명으로 검색"
        placeholder="향수명 · 브랜드로 검색해주세요."
        defaultValue={keyword}
        // key 를 주어 주소가 바뀌면 입력값도 따라옵니다 (초기화 · 뒤로 가기)
        key={keyword}
        onSearch={(next) => {
          setSearchParams(
            withQueryParams(searchParams, {
              keyword: next.trim() || null,
              page: null,
            }),
          )
        }}
      />

      <PerfumeFilters
        ranking={ranking}
        gender={gender}
        onRankingChange={(next) => setFilter('ranking', next)}
        onGenderChange={(next) => setFilter('gender', next)}
      />

      <section className={GLASS_PANEL}>
        <div className="mb-6.25 flex items-baseline gap-2.5">
          <h2 className="text-ink font-serif text-2xl">{heading}</h2>
          {count !== null && (
            <span className="text-ink-muted text-caption">{count}개</span>
          )}
        </div>

        {isError ? (
          <EmptyState
            title="향수를 불러오지 못했습니다"
            description="다시 시도해주세요."
            action={
              <Button variant="outline" onClick={() => refetch()}>
                다시 시도
              </Button>
            }
          />
        ) : (
          <PerfumeGrid
            items={items}
            isPending={isPending}
            columns={6}
            rankable={!searching}
            empty={searchEmpty}
            emptyAction={resetButton}
          />
        )}

        {searching && data && (
          <Pagination
            className="mt-6.25"
            label="검색 결과 페이지"
            page={page}
            size={PAGE_SIZE}
            totalElements={data.totalElements}
            onPageChange={(next) =>
              setSearchParams(writePage(searchParams, next))
            }
          />
        )}
      </section>
    </div>
  )
}
