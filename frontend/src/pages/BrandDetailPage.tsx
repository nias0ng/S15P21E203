import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router'

import { BRAND_PLATE, brandDetailQuery } from '@/features/brand'
import { PerfumeGrid, perfumeListQuery } from '@/features/perfume'
import { ROUTES, toPerfumeSearch } from '@/shared/config/routes'
import { cn } from '@/shared/lib/cn'
import { parseId } from '@/shared/lib/parseId'
import { EmptyState } from '@/shared/ui/EmptyState'
import { LinkButton } from '@/shared/ui/LinkButton'
import { PageFallback } from '@/shared/ui/PageFallback'
import { GLASS_PANEL } from '@/shared/ui/panel'
import { Thumbnail } from '@/shared/ui/Thumbnail'

const PERFUME_PAGE_SIZE = 30

export default function BrandDetailPage() {
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
        title="브랜드를 찾을 수 없습니다"
        description="주소가 잘못되었거나 삭제된 브랜드입니다."
        action={
          <LinkButton to={ROUTES.BRANDS} variant="outline" size="sm">
            브랜드 목록으로
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
        ← 브랜드 목록
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
            {nameKo && (
              <p aria-hidden className="text-ink-muted text-heading">
                {nameKo}
              </p>
            )}
          </div>

          <p className="text-ink-muted text-caption">향수 {perfumeCount}개</p>
        </div>
      </header>

      <section className={GLASS_PANEL}>
        <h2 className="text-ink mb-6.25 font-serif text-2xl">{name}의 향수</h2>

        {perfumes.isError ? (
          <EmptyState
            title="향수 목록을 불러오지 못했습니다"
            description="잠시 후 다시 시도해 주세요."
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
                  title="등록된 향수가 없습니다"
                  description="이 브랜드의 향수가 등록되면 여기에 표시됩니다."
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
                  향수 전체 보기
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
