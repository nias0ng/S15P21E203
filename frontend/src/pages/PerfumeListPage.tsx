import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useSearchParams } from 'react-router'

import {
  perfumeListQuery,
  PerfumeFilters,
  PerfumeGrid,
  type GenderFilter,
  type RankingFilter,
} from '@/features/perfume'
import { useDiveReady } from '@/shared/hooks/useDiveReady'
import { cn } from '@/shared/lib/cn'
import { readPage, withQueryParams, writePage } from '@/shared/lib/queryParams'
import { Button } from '@/shared/ui/Button'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Pagination } from '@/shared/ui/Pagination'
import { GLASS_PANEL } from '@/shared/ui/panel'
import { SearchField, SEARCH_FIELD_LIST_WIDTH } from '@/shared/ui/SearchField'

/** 한 화면에 깔 향수 수(백엔드 기본값은 20). 6열이라 30이면 다섯 줄로 떨어집니다 */
const PAGE_SIZE = 30

/**
 * 향수 (A33 — 상단 메뉴 [향수] 목적지) + 검색 결과 (A09 — COM-05)
 *
 * **A09 는 `/perfumes/search` 로 따로 있던 화면인데 여기로 들어왔습니다**
 * (S15P21E203-359). 검색어는 `?keyword=` 이고 위 줄 필터 · 브랜드와 **AND** 로 함께
 * 겁니다 — 백엔드가 조건을 그렇게 묶습니다(`features/perfume/api.ts` 의 `searchPerfumes`).
 *
 * ⚠️ **쪽 넘김은 검색할 때만입니다.** 검색어가 없으면 예전처럼 첫 30개가 전부입니다 —
 * 목록은 무한 스크롤로 갈 자리라(`docs/UI-명세.md` §6) 쪽 단추를 달아 두면 그때 뗍니다.
 * ⚠️ **검색 중에는 순위 숫자를 끕니다.** 순서가 인기가 아니라 검색 적합도라 전체 순위로
 * 잘못 읽힙니다.
 */
export default function PerfumeListPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [ranking, setRanking] = useState<RankingFilter | null>(null)
  const [gender, setGender] = useState<GenderFilter | null>(null)

  // A34 브랜드 페이지에서 카드를 누르면 ?brand= 를 달고 옵니다
  const brand = searchParams.get('brand')
  const keyword = (searchParams.get('keyword') ?? '').trim()
  const searching = keyword.length > 0
  const page = readPage(searchParams)

  const { data, isPending, isError, refetch } = useQuery(
    perfumeListQuery({
      keyword: searching ? keyword : undefined,
      ranking: ranking ?? undefined,
      gender: gender ?? undefined,
      brand: brand ?? undefined,
      // 검색일 때만 쪽을 셉니다 — 아니면 늘 첫 쪽이라 쿼리 키에 넣을 것이 없습니다
      page: searching ? page : undefined,
      size: PAGE_SIZE,
    }),
  )

  const items = data?.perfumes ?? []

  /*
   * 메인에서 잠수로 들어왔으면 커튼이 짙은 바다색으로 덮은 채 이 신호를 기다립니다
   * (안 알려도 상한에 걷힙니다 — `shared/ui/DiveCurtain`). 잠수로 들어온 것이 아니면
   * 아무 일도 안 일어납니다.
   *
   * 기준은 **목록**입니다 — 아래에서 스피너가 갈리는 바로 그 조건입니다. 목록이 칠해지면
   * 이 화면은 다 선 것이고, 여기는 진열대처럼 뒤늦게 떠오르는 사진 벽이 없습니다.
   */
  useDiveReady(!isPending)

  const filtered = ranking !== null || gender !== null || brand !== null

  /*
    거르는 조건이 바뀌면 쪽을 처음으로 돌립니다 — 3쪽을 보다 '여성' 을 켜면 결과가 줄어
    그 쪽이 비어 있을 수 있습니다. 검색 중이 아니면 쪽이 없어 할 일이 없습니다.
  */
  const toFirstPage = () => {
    if (searching)
      setSearchParams(withQueryParams(searchParams, { page: null }))
  }

  // 검색어·필터로 걸러 0건이 됐을 때만 [초기화] 를 보여줍니다.
  // 원래 데이터가 없는 경우에는 초기화해도 달라지지 않으니 버튼을 걸지 않습니다.
  const resetButton = (filtered || searching) && (
    <Button
      variant="outline"
      onClick={() => {
        setRanking(null)
        setGender(null)
        setSearchParams(
          withQueryParams(searchParams, {
            brand: null,
            keyword: null,
            page: null,
          }),
        )
      }}
    >
      초기화
    </Button>
  )

  /*
    검색이 0건인 두 가지. **건수로 가릅니다** — 줄 수로 보면 범위를 넘은 쪽(주소를 직접
    고친 경우)에서도 "검색 결과가 없습니다" 가 떠서, 결과가 있는데 없다고 말합니다.
    검색이 아닐 때는 `undefined` 라 격자의 기본 문구가 나옵니다.
  */
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

  /*
    검색은 **전체 건수**, 목록은 **그린 개수**입니다. 목록은 첫 30개만 부르므로 전체
    건수를 적으면 "1,284개" 라 써 놓고 서른 장을 그리게 됩니다.
  */
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
        className={cn(SEARCH_FIELD_LIST_WIDTH, 'mx-auto w-full')}
        label="향수명 또는 브랜드명으로 검색"
        placeholder="향수명 · 브랜드로 검색해주세요."
        defaultValue={keyword}
        // key 를 주어 주소가 바뀌면 입력값도 따라옵니다 (초기화 · 뒤로 가기)
        key={keyword}
        onSearch={(next) => {
          // 새로 검색하면 첫 쪽부터 봅니다 — 3쪽에 있던 자리는 의미가 없습니다
          setSearchParams(
            withQueryParams(searchParams, {
              keyword: next.trim() || null,
              page: null,
            }),
          )
        }}
      />

      {brand && (
        <div className="flex items-center gap-2.5">
          <span className="border-line text-ink flex items-center gap-2.5 border px-2.5 py-1.25 text-[11px]">
            브랜드: {brand}
            <button
              type="button"
              aria-label={`브랜드 필터 ${brand} 해제`}
              onClick={() =>
                setSearchParams(
                  withQueryParams(searchParams, { brand: null, page: null }),
                )
              }
              className="text-ink-muted hover:text-ink"
            >
              <span aria-hidden>×</span>
            </button>
          </span>
        </div>
      )}

      <PerfumeFilters
        ranking={ranking}
        gender={gender}
        onRankingChange={(next) => {
          setRanking(next)
          toFirstPage()
        }}
        onGenderChange={(next) => {
          setGender(next)
          toFirstPage()
        }}
      />

      <section className={GLASS_PANEL}>
        <div className="mb-6.25 flex items-baseline gap-2.5">
          {/* 글자 크기·굵기는 S15P21E203-162 타이포 스케일에서 확정합니다 */}
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

        {/* 쪽 넘김은 검색할 때만. 한 쪽뿐이면 Pagination 이 스스로 안 그립니다 */}
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
