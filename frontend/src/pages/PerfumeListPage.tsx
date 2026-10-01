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
            rankable={!searching}
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
