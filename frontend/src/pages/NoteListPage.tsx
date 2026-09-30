import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'

import {
  filterByFamily,
  NoteCategorySections,
  noteFamiliesQuery,
  noteListQuery,
  UNCATEGORIZED,
} from '@/features/note'
import { useDiveReady } from '@/shared/hooks/useDiveReady'
import { withQueryParams } from '@/shared/lib/queryParams'
import { Button } from '@/shared/ui/Button'
import { PillFilter } from '@/shared/ui/PillFilter'
import { SearchField, SEARCH_FIELD_LIST_WIDTH } from '@/shared/ui/SearchField'

export default function NoteListPage() {
  const { t } = useTranslation('note')
  const [searchParams, setSearchParams] = useSearchParams()
  const keyword = searchParams.get('keyword') ?? ''
  const family = searchParams.get('family')

  const { data, isPending } = useQuery(noteListQuery(keyword))
  const { data: families } = useQuery(noteFamiliesQuery)

  useDiveReady(!isPending)

  const shown = filterByFamily(data ?? [], family)
  const hasFilter = keyword !== '' || family !== null

  const setParam = (key: 'keyword' | 'family', value: string | null) => {
    setSearchParams(withQueryParams(searchParams, { [key]: value }))
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

      {families && families.length > 0 && (
        <PillFilter
          label={t('list.familyLabel')}
          options={families.map((value) => ({
            value,
            label:
              value === UNCATEGORIZED ? t('sections.uncategorized') : value,
          }))}
          value={family}
          onChange={(next) => setParam('family', next)}
          className="flex-wrap justify-center"
        />
      )}

      <NoteCategorySections
        notes={shown}
        isPending={isPending}
        emptyAction={
          hasFilter && (
            <Button variant="outline" onClick={() => setSearchParams({})}>
              {t('list.reset')}
            </Button>
          )
        }
      />
    </div>
  )
}
