import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router'

import {
  brandDetailQuery,
  brandPerfumesQuery,
  type BrandPerfume,
} from '@/features/brand'
import { ROUTES, toPerfumeDetail } from '@/shared/config/routes'
import { cn } from '@/shared/lib/cn'
import { Button } from '@/shared/ui/Button'
import { EmptyState } from '@/shared/ui/EmptyState'
import { LinkButton } from '@/shared/ui/LinkButton'
import { PageFallback } from '@/shared/ui/PageFallback'
import { PANEL } from '@/shared/ui/panel'
import { PerfumeCard } from '@/shared/ui/PerfumeCard'
import { Skeleton } from '@/shared/ui/Skeleton'
import { Thumbnail } from '@/shared/ui/Thumbnail'

/**
 * 브랜드 상세 — A34 브랜드 페이지에서 카드를 누른 화면
 *
 * 브랜드 이름 · 소개 · 그 브랜드의 향수 카드를 보여줍니다.
 *
 * **와이어프레임에 없는 신규 화면입니다.** 원래는 브랜드를 누르면 향수 목록에
 * `?brand=` 필터가 걸린 채로 갔는데, 그 화면에는 브랜드의 이름과 소개를 놓을
 * 자리가 없습니다. 구성은 같은 모양인 노트 상세(A36)를 따릅니다.
 *
 * ⚠️ 브랜드는 백엔드 엔드포인트가 없어 소개도 향수 목록도 자리표시자입니다.
 * 향수 목록은 검색 API 의 brand 필터로 대체할 수 있습니다(features/brand/api.ts 주석).
 */
export default function BrandDetailPage() {
  const { brandId } = useParams<{ brandId: string }>()
  const numericId = Number(brandId)
  const valid = Number.isFinite(numericId)

  const brand = useQuery({ ...brandDetailQuery(numericId), enabled: valid })
  const perfumes = useQuery({
    ...brandPerfumesQuery(numericId),
    enabled: valid,
  })

  if (valid && brand.isPending) return <PageFallback />

  // 없는 brandId 와 불러오기 실패를 같은 안내로 묶습니다. 사용자가 할 일(돌아가기 ·
  // 다시 시도)이 같아서, 나눠 봐야 문구만 늘어납니다.
  if (!valid || brand.isError || !brand.data) {
    return (
      <EmptyState
        title="브랜드를 찾을 수 없습니다"
        description="주소가 잘못되었거나 삭제된 브랜드입니다."
        action={
          <div className="flex gap-2">
            <LinkButton to={ROUTES.BRANDS} variant="outline" size="sm">
              브랜드 목록으로
            </LinkButton>
            {valid && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => brand.refetch()}
              >
                다시 시도
              </Button>
            )}
          </div>
        }
      />
    )
  }

  const { name, romanizedName, logoUrl, perfumeCount, description } = brand.data

  return (
    <div className="space-y-6">
      <LinkButton to={ROUTES.BRANDS} variant="outline" size="sm">
        ← 브랜드 목록
      </LinkButton>

      <header className={cn(PANEL, 'flex flex-col gap-5 sm:flex-row')}>
        <Thumbnail
          src={logoUrl}
          fallback="로고"
          fit="contain"
          className="h-28 w-44 shrink-0"
        />

        <div className="flex-1 space-y-3">
          <div className="space-y-1">
            <h1 className="text-ink text-display font-serif font-semibold">
              {name}
            </h1>
            {/*
              로마자 표기는 브랜드명과 같은 말이라 낭독기에 두 번 읽히면 군더더기입니다.
              다만 한글명과 철자가 다른 브랜드가 있어 눈으로는 보여 줍니다.
            */}
            <p aria-hidden className="text-ink-muted text-caption">
              {romanizedName}
            </p>
          </div>

          <p className="text-ink text-body">{description}</p>
        </div>
      </header>

      <section className="space-y-3">
        <div className="flex items-baseline gap-2">
          <h2 className="text-ink text-title font-serif font-semibold">
            {name}의 향수
          </h2>
          {/*
            ⚠️ perfumeCount 는 브랜드 자리표시자의 값이라 아래 카드 수와 다릅니다.
            백엔드가 붙으면 같아집니다.
          */}
          <span className="text-ink-muted text-caption">{perfumeCount}개</span>
        </div>

        <BrandPerfumeGrid
          items={perfumes.data ?? []}
          isPending={perfumes.isPending}
        />
      </section>
    </div>
  )
}

/**
 * 브랜드 향수 카드 그리드.
 *
 * 향수 도메인의 PerfumeGrid 를 쓰지 않습니다 — 그쪽은 PerfumeSummary 를 받는데
 * 브랜드 도메인은 그 타입을 만들 수 없습니다(features 끼리 import 금지). 공용
 * PerfumeCard 는 값을 낱개로 받으므로 그대로 쓸 수 있습니다.
 *
 * 향수 검색 API 로 바꾸는 날에는 이 컴포넌트를 지우고 PerfumeGrid 를 부르면 됩니다.
 */
function BrandPerfumeGrid({
  items,
  isPending,
}: {
  items: BrandPerfume[]
  isPending: boolean
}) {
  const gridClass = 'grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5'

  if (isPending) {
    return (
      <div className={gridClass}>
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} className="rounded-panel h-64" />
        ))}
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <EmptyState
        title="등록된 향수가 없습니다"
        description="이 브랜드의 향수가 등록되면 여기에 표시됩니다."
      />
    )
  }

  return (
    <ul className={gridClass}>
      {items.map((perfume) => (
        <li key={perfume.perfumeId}>
          <PerfumeCard
            name={perfume.name}
            brand={perfume.nameKo}
            thumbnailUrl={perfume.imageUrl}
            to={toPerfumeDetail(perfume.perfumeId)}
          />
        </li>
      ))}
    </ul>
  )
}
