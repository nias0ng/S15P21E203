import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router'

import { BRAND_PLATE, brandDetailQuery } from '@/features/brand'
// 브랜드의 향수는 향수 검색 API 가 돌려줍니다 — features 끼리는 서로 import 할 수
// 없어 화면에서 두 도메인을 조합합니다
import { PerfumeGrid, perfumeListQuery } from '@/features/perfume'
import { ROUTES, toPerfumeSearch } from '@/shared/config/routes'
import { cn } from '@/shared/lib/cn'
import { Button } from '@/shared/ui/Button'
import { EmptyState } from '@/shared/ui/EmptyState'
import { LinkButton } from '@/shared/ui/LinkButton'
import { PageFallback } from '@/shared/ui/PageFallback'
import { GLASS_PANEL } from '@/shared/ui/panel'
import { Thumbnail } from '@/shared/ui/Thumbnail'

// 이 화면에 쪽 넘김은 없습니다 — 향수가 668개인 브랜드도 있어 더 볼 사람은
// [향수 전체 보기] 로 넘깁니다
const PERFUME_PAGE_SIZE = 30

/**
 * 브랜드 상세 — A34 에서 카드를 누른, 와이어프레임에 없는 신규 화면입니다.
 * 향수는 검색 API 에 `brand` 를 걸어 받습니다 — 영문 이름 완전 일치입니다.
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
          <div className="flex justify-center gap-2.5">
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
            {/* 제목과 같은 말이라 낭독기가 두 번 읽지 않게 합니다 */}
            {nameKo && (
              <p aria-hidden className="text-ink-muted text-heading">
                {nameKo}
              </p>
            )}
          </div>

          {/* 향수 수는 상세 응답에만 있습니다 — 목록에서는 이 필드 하나가 133KB 입니다 */}
          <p className="text-ink-muted text-caption">향수 {perfumeCount}개</p>
        </div>
      </header>

      <section className={GLASS_PANEL}>
        <h2 className="text-ink mb-6.25 font-serif text-2xl">{name}의 향수</h2>

        {perfumes.isError ? (
          <EmptyState
            title="향수 목록을 불러오지 못했습니다"
            description="잠시 후 다시 시도해 주세요."
            action={
              <Button variant="outline" onClick={() => perfumes.refetch()}>
                다시 시도
              </Button>
            }
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

            {/*
              검색어는 영문 이름입니다 — 한국어 이름은 향수 쪽에 안 붙은 브랜드가 많아
              0건이 나옵니다. 검색이 부분 일치라 위에 적은 개수와는 어긋날 수 있습니다.
            */}
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

/** 브랜드 표식. 로고가 있으면 로고를, 없으면 영문 첫 글자를 씁니다 */
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
        fallback="로고"
        fit="contain"
        className={cn(plate, 'h-36 w-56 p-5')}
      />
    )
  }

  return (
    <span
      // 낭독기가 첫 글자를 따로 읽으면 "제이, 조 말론 런던" 이 됩니다
      aria-hidden
      className={cn(
        plate,
        // 로고 판(h-36)과 키를 맞춥니다 — 브랜드를 옮겨 다닐 때 아래 판이 튑니다
        'flex size-36 text-4xl',
        'items-center justify-center font-serif',
      )}
    >
      {name.charAt(0)}
    </span>
  )
}
