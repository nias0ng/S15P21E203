import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'

import {
  BRAND_SORTS,
  BrandGrid,
  brandListQuery,
  DEFAULT_BRAND_SORT,
} from '@/features/brand'
import { useDiveReady } from '@/shared/hooks/useDiveReady'
import {
  readOption,
  readPage,
  withQueryParams,
  writePage,
} from '@/shared/lib/queryParams'
import { Button } from '@/shared/ui/Button'
import { Pagination } from '@/shared/ui/Pagination'
import { GLASS_PANEL } from '@/shared/ui/panel'
import { PillFilter } from '@/shared/ui/PillFilter'
import { SearchField, SEARCH_FIELD_LIST_WIDTH } from '@/shared/ui/SearchField'

// NOTE: 목록 API 에 쪽이 붙으면 자르기를 걷고 `brandListQuery` 에 page 를 넘기세요
const PAGE_SIZE = 30

export default function BrandListPage() {
  const { t } = useTranslation('brand')
  const [searchParams, setSearchParams] = useSearchParams()
  const keyword = searchParams.get('keyword') ?? ''
  const sort =
    readOption(searchParams.get('sort'), BRAND_SORTS) ?? DEFAULT_BRAND_SORT
  const page = readPage(searchParams)

  const { data, isPending } = useQuery(brandListQuery({ keyword, sort }))
  const brands = data ?? []

  useDiveReady(!isPending)

  const lastPage = Math.max(0, Math.ceil(brands.length / PAGE_SIZE) - 1)
  const safePage = Math.min(page, lastPage)
  const shown = brands.slice(
    safePage * PAGE_SIZE,
    safePage * PAGE_SIZE + PAGE_SIZE,
  )

  const hasFilter = keyword !== '' || sort !== DEFAULT_BRAND_SORT

  const setParam = (key: 'keyword' | 'sort', value: string | null) => {
    setSearchParams(
      writePage(withQueryParams(searchParams, { [key]: value }), 0),
    )
  }

  const goToPage = (next: number) => {
    setSearchParams(writePage(searchParams, next))
    window.scrollTo({ top: 0 })
  }

  return (
    <div className="space-y-3.75">
      <h1 className="sr-only">{t('list.heading')}</h1>

      <SearchField
        className={SEARCH_FIELD_LIST_WIDTH}
        label={t('list.searchLabel')}
        placeholder={t('list.searchPlaceholder')}
        defaultValue={keyword}
        key={keyword}
        onSearch={(next) => setParam('keyword', next.trim() || null)}
      />

      <PillFilter
        label={t('list.sortLabel')}
        options={BRAND_SORTS.map(({ value }) => ({
          value,
          label: t(`sort.${value}`),
        }))}
        value={sort}
        onChange={(next) => setParam('sort', next)}
        required
        className="flex-wrap justify-center"
      />

      <section className={GLASS_PANEL}>
        <div className="mb-6.25 flex items-baseline gap-2.5">
          <h2 className="text-ink font-serif text-2xl">
            {keyword
              ? t('list.searchHeading', { keyword })
              : t('list.allHeading')}
          </h2>
          {!isPending && brands.length > 0 && (
            <span className="text-ink-muted text-caption">
              {t('list.count', { count: brands.length })}
            </span>
          )}
        </div>

        <BrandGrid
          items={shown}
          isPending={isPending}
          skeletonCount={PAGE_SIZE}
          emptyAction={
            hasFilter && (
              <Button variant="outline" onClick={() => setSearchParams({})}>
                {t('list.reset')}
              </Button>
            )
          }
        />

        <Pagination
          className="mt-6.25"
          label={t('list.pagination')}
          page={safePage}
          size={PAGE_SIZE}
          totalElements={brands.length}
          onPageChange={goToPage}
        />
      </section>
    </div>
  )
}
