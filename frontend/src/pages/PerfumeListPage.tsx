import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
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

const PAGE_SIZE = 30

// NOTE: 쪽 넘김은 검색할 때만이고, 검색어가 없으면 첫 30개가 전부입니다
export default function PerfumeListPage() {
  const { t } = useTranslation('perfume')
  const [searchParams, setSearchParams] = useSearchParams()

  // NOTE: 필터는 `useState` 가 아니라 주소에 둡니다
  // 상세로 갔다 오면 이 화면이 새로 만들어져 `useState` 는 처음 값으로 돌아갑니다.
  // 값은 사람이 고쳐 쓸 수 있으므로 읽을 때 거릅니다.
  const ranking = readRankingFilter(searchParams.get('ranking'))
  const gender = readGenderFilter(searchParams.get('gender'))
  const keyword = (searchParams.get('keyword') ?? '').trim()
  const searching = keyword.length > 0
  const page = readPage(searchParams)

  /*
    NOTE: 아무 조건도 없을 때 **국내 선정 순위(POPULAR)** 로 줄 세웁니다. 전에는 기준 없이
    불러 백엔드 기본 정렬(향수 번호순)이 나왔는데, 제목은 '인기 향수' 라 번호가 빠른 외국
    향수가 인기 1위처럼 보였습니다(지인 피드백 F7 · F23). 검색할 때는 이름으로 찾은 것이라
    순위를 걸지 않습니다 — 걸면 순위 밖 13만 개가 결과에서 빠집니다.
  */
  const effectiveRanking = ranking ?? (searching ? undefined : 'POPULAR')

  const { data, isPending, isError, refetch } = useQuery(
    perfumeListQuery({
      keyword: searching ? keyword : undefined,
      ranking: effectiveRanking,
      gender: gender ?? undefined,
      page: searching ? page : undefined,
      size: PAGE_SIZE,
    }),
  )

  const items = data?.perfumes ?? []

  useDiveReady(!isPending)

  const filtered = ranking !== null || gender !== null

  const setFilter = (key: 'ranking' | 'gender', value: string | null) => {
    setSearchParams(withQueryParams(searchParams, { [key]: value, page: null }))
  }

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
      {t('list.reset')}
    </Button>
  )

  const searchEmpty =
    !searching || !data ? undefined : data.totalElements > 0 ? (
      <EmptyState
        title={t('list.pageEmptyTitle')}
        description={t('list.pageEmptyDescription')}
      />
    ) : (
      <EmptyState
        title={t('list.searchEmptyTitle')}
        description={t('list.searchEmptyDescription', { keyword })}
        action={resetButton}
      />
    )

  const heading = searching
    ? t('list.headingSearch')
    : filtered
      ? t('list.headingFiltered')
      : t('list.headingPopular')

  const count = searching
    ? (data?.totalElements ?? null)
    : items.length > 0
      ? items.length
      : null

  return (
    <div className="space-y-3.75">
      <h1 className="sr-only">{t('list.heading')}</h1>

      <SearchField
        className={SEARCH_FIELD_LIST_WIDTH}
        label={t('list.searchLabel')}
        placeholder={t('list.searchPlaceholder')}
        defaultValue={keyword}
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
            <span className="text-ink-muted text-caption">
              {t('list.count', { count })}
            </span>
          )}
        </div>

        {isError ? (
          <EmptyState
            title={t('list.loadErrorTitle')}
            description={t('list.loadErrorDescription')}
            onRetry={() => refetch()}
          />
        ) : (
          <PerfumeGrid
            items={items}
            isPending={isPending}
            columns={6}
            /*
              순위 번호는 줄 세운 기준 그대로일 때만 붙입니다. 성별로 거르면 차례가 건너뛰어
              3위가 '1위' 로 적힙니다.
            */
            rankable={!searching && gender === null}
            empty={searchEmpty}
            emptyAction={resetButton}
          />
        )}

        {searching && data && (
          <Pagination
            className="mt-6.25"
            label={t('list.pagination')}
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
