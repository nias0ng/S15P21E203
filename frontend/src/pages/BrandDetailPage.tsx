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
import { GLASS_PANEL } from '@/shared/ui/panel'
import { Thumbnail } from '@/shared/ui/Thumbnail'

/**
 * 한 브랜드의 향수를 한 화면에 몇 개까지 깔지.
 *
 * **6열이라 30이면 정확히 다섯 줄로 떨어집니다** — 향수 목록(A33)과 같은 값입니다.
 * 20이었을 때는 마지막 줄에 두 장만 남아 격자 오른쪽이 잘린 것처럼 보였습니다.
 *
 * ⚠️ **이 화면에는 쪽 넘김이 없습니다.** 브랜드 하나에 향수가 668개인 곳도 있어
 * (제키치) 여기서 다 넘기게 하면 23쪽이 됩니다. 브랜드 상세는 "이 브랜드가 어떤
 * 곳인가" 를 보는 자리지 카탈로그를 훑는 자리가 아닙니다. 더 볼 사람은 아래
 * [향수 전체 보기]로 넘깁니다 — 쪽 넘김이 그쪽에 이미 있습니다.
 */
const PERFUME_PAGE_SIZE = 30

/**
 * 브랜드 상세 — A34 브랜드 페이지에서 카드를 누른 화면
 *
 * **와이어프레임에 없는 신규 화면입니다.**
 *
 * 향수 목록(A33) · 브랜드(A34) · 노트(A35 · A36) · 향수 상세(A10)와 같은
 * **어두운 방 + 유리판** 구성입니다. 어둠은 라우트의 `handle.night` 이 켜고
 * (app/router), 판은 아래 향수 격자가 `GLASS_PANEL` 로 답니다. 머리 구역은 판
 * 없이 어둠에 바로 놓입니다 — 향수 상세의 개요와 같은 이유로, 판을 두 장 쌓으면
 * 층이 안 읽힙니다.
 *
 * 이 화면만 밝은 종이였던 때가 있었습니다. 브랜드 목록에서 카드를 누르면 유리판
 * 위 어둠에서 흰 종이로 화면이 통째로 뒤집혔습니다.
 *
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
  const title = nameKo ?? name

  return (
    <div className="space-y-6.25">
      <LinkButton to={ROUTES.BRANDS} variant="outline" size="sm">
        ← 브랜드 목록
      </LinkButton>

      {/*
        머리 구역을 **가운데 세우는** 이유는 담을 것이 로고 · 이름 · 개수뿐이어서
        입니다. 브랜드에는 소개글 컬럼이 없어(features/brand/types.ts) 향수 상세처럼
        왼쪽에 붙이면 오른쪽 절반이 통째로 빕니다. 브랜드 목록의 검색창 · 알약도
        가운데라, 목록에서 상세로 들어올 때 시선이 같은 축에 머뭅니다.
      */}
      <header className="flex flex-col items-center gap-3.75 text-center">
        <BrandMark name={name} logoUrl={logoUrl} />

        <div className="space-y-2.5">
          {/* 이름 묶음은 바짝 붙입니다 — 둘은 "무엇의 무엇" 한 덩이입니다 */}
          <div className="space-y-0.5">
            {/*
              `text-display`(28) 가 아니라 Tailwind 스케일의 36 입니다. 브랜드
              상세는 머리에 담긴 것이 이름 하나뿐이라, 향수 상세처럼 사진 · 액션과
              무게를 나눠 갖지 않습니다. 28로 두면 넓은 어둠 한가운데 작은 글자
              하나가 떠 있는 모양이었습니다.
            */}
            <h1 className="text-ink font-serif text-4xl font-semibold">
              {title}
            </h1>
            {/*
              영문 표기는 브랜드명과 같은 말이라 낭독기에 두 번 읽히면 군더더기입니다.
              다만 한글명과 철자가 다른 브랜드가 있어 눈으로는 보여 줍니다.
              한국어 이름이 없으면 제목이 이미 영문이라 이 줄을 그리지 않습니다.
            */}
            {nameKo && (
              <p aria-hidden className="text-ink-muted text-heading">
                {name}
              </p>
            )}
          </div>

          {/*
            향수 수는 **상세 응답에만 있습니다** — 목록에서는 브랜드가 7,793개라
            필드 하나가 133KB 여서 뺐습니다. 아래 격자 제목 옆에도 같은 숫자를
            적었었는데, 한 화면에 두 번 나오면 둘이 다른 값인가 싶어집니다.
          */}
          <p className="text-ink-muted text-caption">향수 {perfumeCount}개</p>
        </div>
      </header>

      {/*
        유리판. 향수 격자가 이 판 위에 놓입니다 — 어두운 방 안의 밝은 표면이라
        판 안쪽은 색 토큰이 다시 정의됩니다 (styles/scent-display.css 의 .scent-glass).
      */}
      <section className={GLASS_PANEL}>
        {/* 판 위 제목은 브랜드 목록 · 향수 목록과 같은 크기입니다 */}
        <h2 className="text-ink mb-6.25 font-serif text-2xl">{title}의 향수</h2>

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
              깔아 놓은 30개보다 향수가 많으면 넓은 화면으로 넘깁니다.

              **검색 결과(A09)로 보냅니다** — 향수 목록의 `?brand=` 필터가 아닙니다.
              필터 쪽이 브랜드명 완전 일치라 더 정확하지만, 걸린 필터가 알약 한 줄로만
              보여서 누른 사람에게는 그냥 향수 목록에 떨어진 것처럼 읽혔습니다.

              검색어는 **영문 이름**입니다. 한국어 이름은 향수 쪽에 안 붙어 있는
              브랜드가 많아 0건이 나옵니다.

              ⚠️ 검색은 향수명 · 브랜드명 **부분 일치**라 위에 적은 개수와 결과 수가
              어긋날 수 있습니다 — 이름이 짧은 브랜드는 다른 브랜드 향수가 섞입니다.
            */}
            {perfumeCount > PERFUME_PAGE_SIZE && (
              <div className="mt-6.25 flex justify-center">
                <LinkButton
                  to={`${ROUTES.PERFUME_SEARCH}?keyword=${encodeURIComponent(name)}`}
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

/**
 * 브랜드 표식. 로고가 있으면 로고를, 없으면 영문 첫 글자를 씁니다.
 *
 * ⚠️ **판을 흰색으로 못박습니다.** 두 사정이 겹칩니다.
 *
 * 하나, 브랜드 로고는 배경이 투명한 PNG 에 검은 글자가 대부분입니다. 어두운 방에
 * 그냥 얹으면 로고가 어둠에 묻힙니다 — 향수 상세가 병 사진 뒤를 `bg-white` 로
 * 못박은 것과 같은 사정입니다.
 *
 * 둘, `Thumbnail` 의 기본 상자는 `bg-surface-sunken` 인데 `.scent-night` 는 이
 * 토큰만 다시 정의하지 않습니다 (styles/scent-display.css — 유리판 **안쪽**에서만
 * 뒤집힙니다). 그대로 두면 어둠 위에 아이보리 상자가 남습니다.
 *
 * 그래서 이 판 위의 글자는 역할 토큰을 못 씁니다. 어두운 방의 `text-ink-muted` 는
 * 밝은 색이라 흰 판 위에서 사라집니다 — 검색창(`SearchField`)이 같은 이유로
 * `text-charcoal-soft` 를 쓰고 있어 그쪽과 맞췄습니다.
 */
function BrandMark({
  name,
  logoUrl,
}: {
  name: string
  logoUrl: string | null
}) {
  const plate = 'rounded-panel border border-black/10 bg-white'

  if (logoUrl) {
    return (
      <Thumbnail
        src={logoUrl}
        fallback="로고"
        fit="contain"
        // 안쪽 여백이 없으면 로고가 판 끝에 닿아 잘린 것처럼 보입니다
        className={cn(plate, 'h-36 w-56 p-5')}
      />
    )
  }

  return (
    <span
      // 이름은 바로 아래에 글자로 있습니다. 낭독기가 첫 글자를 따로 읽으면
      // "제이, 조 말론 런던" 이 됩니다.
      aria-hidden
      className={cn(
        plate,
        // 로고 판(h-36)과 키를 맞춥니다 — 로고가 있고 없고에 따라 머리 높이가
        // 달라지면 브랜드를 옮겨 다닐 때 아래 유리판이 위아래로 튑니다
        'text-charcoal-soft flex size-36 text-4xl',
        'items-center justify-center font-serif',
      )}
    >
      {name.charAt(0)}
    </span>
  )
}
