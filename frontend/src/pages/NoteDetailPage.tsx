import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useParams, useSearchParams } from 'react-router'

import { noteDetailQuery, notePerfumesQuery } from '@/features/note'
import { PerfumeGrid } from '@/features/perfume'
import { ROUTES } from '@/shared/config/routes'
import { parseId } from '@/shared/lib/parseId'
import { readPage, writePage } from '@/shared/lib/queryParams'
import { useLocale } from '@/shared/store/localeStore'
import { Button } from '@/shared/ui/Button'
import { EmptyState } from '@/shared/ui/EmptyState'
import { LinkButton } from '@/shared/ui/LinkButton'
import { PageFallback } from '@/shared/ui/PageFallback'
import { Pagination } from '@/shared/ui/Pagination'
import { GLASS_PANEL } from '@/shared/ui/panel'
import { Thumbnail } from '@/shared/ui/Thumbnail'

// NOTE: 브랜드 상세와 달리 [향수 전체 보기] 로 넘기지 못합니다
// 향수 검색 파라미터에 `note` 가 없어 노트의 향수는 `/notes/{noteId}/perfumes` 에만 있습니다.
export default function NoteDetailPage() {
  const { t } = useTranslation('note')
  const locale = useLocale()
  const { noteId } = useParams<{ noteId: string }>()
  const numericId = parseId(noteId)
  const valid = numericId !== null

  const [searchParams, setSearchParams] = useSearchParams()
  const page = readPage(searchParams)

  const note = useQuery({
    ...noteDetailQuery(numericId ?? 0),
    enabled: valid,
  })
  const perfumes = useQuery({
    ...notePerfumesQuery(numericId ?? 0, page),
    enabled: valid,
  })

  if (valid && note.isPending) return <PageFallback />

  if (!valid || note.isError || !note.data) {
    return (
      <EmptyState
        title={t('detail.notFoundTitle')}
        description={t('detail.notFoundDescription')}
        action={
          <div className="flex justify-center gap-2.5">
            {valid && (
              <Button variant="outline" onClick={() => note.refetch()}>
                {t('detail.retry')}
              </Button>
            )}
            <LinkButton to={ROUTES.NOTES} size="sm">
              {t('detail.list')}
            </LinkButton>
          </div>
        }
      />
    )
  }

  const data = note.data

  return (
    <div className="space-y-6.25">
      <LinkButton to={ROUTES.NOTES} variant="outline" size="sm">
        ← {t('detail.list')}
      </LinkButton>

      <header className="flex items-center gap-7.5">
        <Thumbnail
          src={data.imageUrl}
          fallback={t('detail.imageFallback')}
          // NOTE: 바탕을 덮어씁니다 — 그대로 두면 어둠 위에 아이보리 사각형이 남습니다
          className="aspect-7/5 h-60 shrink-0 bg-white/5"
        />

        <div className="space-y-0.5">
          <h1 className="text-ink font-serif text-4xl font-semibold">
            {data.name}
          </h1>
          {locale !== 'en' && data.nameKo && data.nameKo !== data.name && (
            <p className="text-ink-muted text-heading">{data.nameKo}</p>
          )}
        </div>
      </header>

      {data.description && (
        <section className={GLASS_PANEL}>
          <p className="text-ink text-heading leading-relaxed">
            {data.description}
          </p>
        </section>
      )}

      <section className={GLASS_PANEL}>
        <div className="mb-6.25 flex items-baseline gap-2.5">
          <h2 className="text-ink font-serif text-2xl">
            {t('detail.perfumesHeading')}
          </h2>
          {!perfumes.isPending && !!perfumes.data?.totalElements && (
            <span className="text-ink-muted text-caption">
              {t('detail.perfumeCount', {
                count: perfumes.data.totalElements,
                total: perfumes.data.totalElements.toLocaleString(locale),
              })}
            </span>
          )}
        </div>

        {perfumes.isError ? (
          <EmptyState
            title={t('detail.loadErrorTitle')}
            description={t('detail.loadErrorDescription')}
            onRetry={() => perfumes.refetch()}
          />
        ) : (
          <>
            <PerfumeGrid
              items={perfumes.data?.perfumes ?? []}
              isPending={perfumes.isPending}
              columns={5}
              empty={
                <EmptyState
                  title={t('detail.emptyTitle')}
                  description={t('detail.emptyDescription')}
                />
              }
            />

            {perfumes.data && (
              <Pagination
                className="mt-6.25"
                label={t('detail.pagination')}
                page={page}
                size={perfumes.data.size}
                totalElements={perfumes.data.totalElements}
                onPageChange={(next) =>
                  setSearchParams(writePage(searchParams, next))
                }
              />
            )}
          </>
        )}
      </section>
    </div>
  )
}
