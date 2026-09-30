import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router'

import { BRAND_PLATE, brandDetailQuery } from '@/features/brand'
import { PerfumeGrid, perfumeListQuery } from '@/features/perfume'
import { ROUTES, toPerfumeSearch } from '@/shared/config/routes'
import { cn } from '@/shared/lib/cn'
import { parseId } from '@/shared/lib/parseId'
import { useLocale } from '@/shared/store/localeStore'
import { EmptyState } from '@/shared/ui/EmptyState'
import { LinkButton } from '@/shared/ui/LinkButton'
import { PageFallback } from '@/shared/ui/PageFallback'
import { GLASS_PANEL } from '@/shared/ui/panel'
import { Thumbnail } from '@/shared/ui/Thumbnail'

const PERFUME_PAGE_SIZE = 30

export default function BrandDetailPage() {
  const { t } = useTranslation('brand')
  const locale = useLocale()
  const { brandId } = useParams<{ brandId: string }>()
  const numericId = parseId(brandId)
  const valid = numericId !== null

  const brand = useQuery({
    ...brandDetailQuery(numericId ?? 0),
    enabled: valid,
  })

  const perfumes = useQuery({
    ...perfumeListQuery({
      brandId: numericId ?? undefined,
      size: PERFUME_PAGE_SIZE,
    }),
    enabled: valid,
  })

  if (valid && brand.isPending) return <PageFallback />

  if (!valid || brand.isError || !brand.data) {
    return (
      <EmptyState
        title={t('detail.notFoundTitle')}
        description={t('detail.notFoundDescription')}
        action={
          <LinkButton to={ROUTES.BRANDS} variant="outline" size="sm">
            {t('detail.backToList')}
          </LinkButton>
        }
        onRetry={valid ? () => brand.refetch() : undefined}
        retrySize="sm"
      />
    )
  }

  const { name, nameKo, logoUrl, perfumeCount } = brand.data

  return (
    <div className="space-y-6.25">
      <LinkButton to={ROUTES.BRANDS} variant="outline" size="sm">
        ← {t('detail.back')}
      </LinkButton>

      <header className="flex flex-col items-center gap-3.75 text-center">
        <BrandMark name={name} logoUrl={logoUrl} />

        <div className="space-y-2.5">
          <div className="space-y-0.5">
            <h1
              className="text-ink font-serif text-4xl font-semibold"
              lang="en"
            >
              {name}
            </h1>
            {nameKo && locale !== 'en' && (
              <p aria-hidden className="text-ink-muted text-heading">
                {nameKo}
              </p>
            )}
          </div>

          <p className="text-ink-muted text-caption">
            {t('detail.perfumeCount', { count: perfumeCount })}
          </p>
        </div>
      </header>

      <section className={GLASS_PANEL}>
        <h2 className="text-ink mb-6.25 font-serif text-2xl">
          {t('detail.perfumesHeading', { name })}
        </h2>

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
              columns={6}
              empty={
                <EmptyState
                  title={t('detail.emptyTitle')}
                  description={t('detail.emptyDescription')}
                />
              }
            />

            {perfumeCount > PERFUME_PAGE_SIZE && (
              <div className="mt-6.25 flex justify-center">
                <LinkButton
                  to={toPerfumeSearch(name)}
                  variant="outline"
                  size="sm"
                >
                  {t('detail.viewAll')}
                </LinkButton>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  )
}

function BrandMark({
  name,
  logoUrl,
}: {
  name: string
  logoUrl: string | null
}) {
  const plate = cn('rounded-panel', BRAND_PLATE)

  if (logoUrl) {
    return (
      <Thumbnail
        src={logoUrl}
        fit="contain"
        className={cn(plate, 'h-36 w-56 p-5')}
      />
    )
  }

  return (
    <span
      aria-hidden
      className={cn(
        plate,
        'flex size-36 text-4xl',
        'items-center justify-center font-serif',
      )}
    >
      {name.charAt(0)}
    </span>
  )
}
