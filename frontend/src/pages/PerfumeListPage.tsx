import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'

import {
  perfumeListQuery,
  PerfumeFilters,
  PerfumeGrid,
  type GenderFilter,
  type RankingFilter,
} from '@/features/perfume'
import { ROUTES } from '@/shared/config/routes'
import { cn } from '@/shared/lib/cn'
import { withQueryParams } from '@/shared/lib/queryParams'
import { Button } from '@/shared/ui/Button'
import { GLASS_PANEL } from '@/shared/ui/panel'
import { SearchField, SEARCH_FIELD_LIST_WIDTH } from '@/shared/ui/SearchField'

/**
 * 한 화면에 깔 향수 수. 백엔드 기본값은 20 입니다.
 *
 * 6열이라 30이면 정확히 다섯 줄로 떨어집니다 — 20이면 마지막 줄에 두 장만 남아
 * 격자 오른쪽이 비어 끝이 잘린 것처럼 보였습니다.
 */
const PAGE_SIZE = 30

/**
 * 향수 (와이어프레임 A33 — 상단 메뉴 [향수] 목적지)
 *
 * 와이어프레임 주석:
 * - 아무 필터도 고르지 않은 상태가 기본 — 전체 향수를 보여준다
 * - 카드를 누르면 향수 상세(A10) · 스크롤하면 이어서 로드
 *
 * 필터를 고르기 전에는 "최근 인기 향수" 라는 제목으로 전체를 깔아 둡니다.
 * 첫 화면이 빈 상태로 시작하면 무엇을 하는 화면인지 알 수 없기 때문입니다.
 *
 * 조건을 하나도 보내지 않으면 백엔드가 활성 향수 전체를 돌려줍니다.
 *
 * 위 줄 필터(ranking)는 **전체 사용자 집계** 기준입니다. 내 진열대가 아니라
 * 많은 사람이 진열대에 담은 순으로 좁힙니다. 로그인이 필요 없습니다.
 *
 * TODO: 스크롤 이어서 로드(무한 스크롤). 백엔드 페이지네이션은 이미 준비돼 있어
 * useInfiniteQuery 로 바꾸면 됩니다. 지금은 첫 페이지만 불러옵니다.
 */
export default function PerfumeListPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [ranking, setRanking] = useState<RankingFilter | null>(null)
  const [gender, setGender] = useState<GenderFilter | null>(null)

  // A34 브랜드 페이지에서 카드를 누르면 ?brand= 를 달고 옵니다
  const brand = searchParams.get('brand')

  const { data, isPending } = useQuery(
    perfumeListQuery({
      ranking: ranking ?? undefined,
      gender: gender ?? undefined,
      brand: brand ?? undefined,
      size: PAGE_SIZE,
    }),
  )

  const items = data?.perfumes ?? []

  // 검색어·필터로 걸러 0건이 됐을 때만 [초기화] 를 보여줍니다.
  // 원래 데이터가 없는 경우에는 초기화해도 달라지지 않으니 버튼을 걸지 않습니다.
  const hasFilter = ranking !== null || gender !== null || brand !== null

  const resetFilters = () => {
    setRanking(null)
    setGender(null)
    setSearchParams(withQueryParams(searchParams, { brand: null }))
  }

  return (
    <div className="space-y-3.75">
      <h1 className="sr-only">향수</h1>

      {/*
        헤더에 검색창이 없고 검색은 각 페이지 안에 있다는 와이어프레임 규칙.

        폭을 본문 끝까지 늘리지 않고 **가운데**에 둡니다 — 1440 에서 꽉 채우면
        입력칸 하나가 화면 위쪽을 가로지르는 가장 큰 덩이가 되어, 아래 향수 격자보다
        먼저 눈에 듭니다. 가운데에 두는 것은 메인(3D 향 지도)과 같은 자리입니다.
      */}
      <SearchField
        className={cn(SEARCH_FIELD_LIST_WIDTH, 'mx-auto w-full')}
        label="향수명 또는 브랜드명으로 검색"
        placeholder="향수명 · 브랜드로 검색해주세요."
        onSearch={(keyword) => {
          const trimmed = keyword.trim()
          if (!trimmed) return
          // 검색을 누르면 검색 결과 화면(A09)으로 넘깁니다
          navigate(
            `${ROUTES.PERFUME_SEARCH}?keyword=${encodeURIComponent(trimmed)}`,
          )
        }}
      />

      {brand && (
        <div className="flex items-center gap-2.5">
          <span className="border-line text-ink flex items-center gap-2.5 border px-2.5 py-1.25 text-[11px]">
            브랜드: {brand}
            <button
              type="button"
              aria-label={`브랜드 필터 ${brand} 해제`}
              onClick={() =>
                setSearchParams(withQueryParams(searchParams, { brand: null }))
              }
              className="text-ink-muted hover:text-ink"
            >
              <span aria-hidden>×</span>
            </button>
          </span>
        </div>
      )}

      <PerfumeFilters
        ranking={ranking}
        gender={gender}
        onRankingChange={setRanking}
        onGenderChange={setGender}
      />

      {/*
        유리판. 향수 격자는 이 판 위에 놓입니다 — 어두운 방 안의 밝은 표면이라
        판 안쪽은 색 토큰이 다시 밝은 화면 값으로 돌아갑니다
        (styles/scent-display.css 의 .scent-glass).

        구분선(hr)을 걷어냈습니다. 판 테두리가 이미 "여기서부터 목록" 을 긋고 있어
        선을 또 그으면 경계가 두 겹이 됩니다.
      */}
      <section className={GLASS_PANEL}>
        <div className="mb-6.25 flex items-baseline gap-2.5">
          {/* 글자 크기·굵기는 S15P21E203-162 타이포 스케일에서 확정합니다 */}
          <h2 className="text-ink font-serif text-2xl">
            {hasFilter ? '조건에 맞는 향수' : '최근 인기 향수'}
          </h2>
          {items.length > 0 && (
            <span className="text-ink-muted text-caption">
              {items.length}개
            </span>
          )}
        </div>

        <PerfumeGrid
          items={items}
          isPending={isPending}
          columns={6}
          rankable
          emptyAction={
            hasFilter && (
              <Button variant="outline" onClick={resetFilters}>
                초기화
              </Button>
            )
          }
        />
      </section>
    </div>
  )
}
