import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router'

import { brandDetailQuery } from '@/features/brand'
// 브랜드의 향수는 향수 검색 API 의 brand 필터가 돌려줍니다. 화면에서 두 도메인을
// 조합합니다 — features 끼리는 서로 import 할 수 없습니다.
import { PerfumeGrid, perfumeListQuery } from '@/features/perfume'
import { ROUTES } from '@/shared/config/routes'
import { cn } from '@/shared/lib/cn'
import { Button } from '@/shared/ui/Button'
import { EmptyState } from '@/shared/ui/EmptyState'
import { LinkButton } from '@/shared/ui/LinkButton'
import { PageFallback } from '@/shared/ui/PageFallback'
import { PANEL } from '@/shared/ui/panel'
import { Thumbnail } from '@/shared/ui/Thumbnail'

/** 한 브랜드가 가진 향수를 한 번에 몇 개까지 보여줄지. 백엔드 최대는 100 입니다. */
const PERFUME_PAGE_SIZE = 20

/**
 * 브랜드 상세 — A34 브랜드 페이지에서 카드를 누른 화면
 *
 * **와이어프레임에 없는 신규 화면입니다.** 구성은 같은 모양인 노트 상세(A36)를 따릅니다.
 *
 * 브랜드 상세 엔드포인트가 없어 브랜드 자체는 목록에서 골라냅니다(brandDetailQuery).
 * 향수는 검색 API 에 `brand` 를 걸어 받습니다 — **영문 이름 완전 일치**입니다.
 */
export default function BrandDetailPage() {
  const { brandId } = useParams<{ brandId: string }>()
  const numericId = Number(brandId)
  const valid = Number.isFinite(numericId)

  const brand = useQuery({ ...brandDetailQuery(numericId), enabled: valid })

  const perfumes = useQuery({
    ...perfumeListQuery({
      brand: brand.data?.name,
      size: PERFUME_PAGE_SIZE,
    }),
    // 브랜드 이름을 알기 전에는 부를 수 없습니다 — 필터 없이 부르면 전체 카탈로그입니다
    enabled: brand.data != null,
  })

  if (valid && brand.isPending) return <PageFallback />

  // 없는 brandId 와 불러오기 실패를 같은 안내로 묶습니다 — 할 일이 같습니다
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

  const { name, nameKo, logoUrl } = brand.data
  const title = nameKo ?? name

  return (
    <div className="space-y-6">
      <LinkButton to={ROUTES.BRANDS} variant="outline" size="sm">
        ← 브랜드 목록
      </LinkButton>

      <header className={cn(PANEL, 'flex items-center gap-6')}>
        <BrandMark name={name} logoUrl={logoUrl} />

        <div className="space-y-1">
          <h1 className="text-ink text-display font-serif font-semibold">
            {title}
          </h1>
          {/*
            영문 표기는 브랜드명과 같은 말이라 낭독기에 두 번 읽히면 군더더기입니다.
            다만 한글명과 철자가 다른 브랜드가 있어 눈으로는 보여 줍니다.
            한국어 이름이 없으면 제목이 이미 영문이라 이 줄을 그리지 않습니다.
          */}
          {nameKo && (
            <p aria-hidden className="text-ink-muted text-caption">
              {name}
            </p>
          )}
        </div>
      </header>

      <section className="space-y-3">
        <div className="flex items-baseline gap-2">
          <h2 className="text-ink text-title font-serif font-semibold">
            {title}의 향수
          </h2>
          {/* 불러오는 중에는 아예 적지 않습니다 — 0 이 잠깐 보였다 바뀌면 눈에 띕니다 */}
          {!perfumes.isPending && perfumes.data && (
            <span className="text-ink-muted text-caption">
              {perfumes.data.totalElements}개
            </span>
          )}
        </div>

        <PerfumeGrid
          items={perfumes.data?.perfumes ?? []}
          isPending={perfumes.isPending}
          empty={
            <EmptyState
              title="등록된 향수가 없습니다"
              description="이 브랜드의 향수가 등록되면 여기에 표시됩니다."
            />
          }
        />

        {/*
          첫 20개만 보여줍니다. 브랜드 하나에 향수가 그보다 많으면 향수 페이지에서
          같은 필터로 이어 봅니다 — 페이지 넘김이 그쪽에 이미 있습니다.
        */}
        {perfumes.data && perfumes.data.totalElements > PERFUME_PAGE_SIZE && (
          <div className="flex justify-center">
            <LinkButton
              to={`${ROUTES.PERFUMES}?brand=${encodeURIComponent(name)}`}
              variant="outline"
              size="sm"
            >
              향수 전체 보기
            </LinkButton>
          </div>
        )}
      </section>
    </div>
  )
}

/**
 * 브랜드 표식. 로고가 있으면 로고를, 없으면 영문 첫 글자를 씁니다.
 *
 * 자리표시자 상자를 두지 않는 이유는 로고가 없는 브랜드가 훨씬 많아서입니다 —
 * 그러면 열 개 브랜드가 전부 같은 회색 사각형이 됩니다.
 */
function BrandMark({
  name,
  logoUrl,
}: {
  name: string
  logoUrl: string | null
}) {
  if (logoUrl) {
    return (
      <Thumbnail
        src={logoUrl}
        fallback="로고"
        fit="contain"
        className="h-28 w-44 shrink-0"
      />
    )
  }

  return (
    <span
      // 이름은 바로 옆에 글자로 있습니다. 낭독기가 첫 글자를 따로 읽으면
      // "제이, 조 말론 런던" 이 됩니다.
      aria-hidden
      className={cn(
        'border-line/50 bg-surface-sunken rounded-panel border',
        'text-ink-muted text-display flex size-24 shrink-0',
        'items-center justify-center font-serif',
      )}
    >
      {name.charAt(0)}
    </span>
  )
}
