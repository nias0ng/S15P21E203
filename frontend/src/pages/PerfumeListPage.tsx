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

/** 한 화면에 깔 향수 수(백엔드 기본값은 20). 6열이라 30이면 다섯 줄로 떨어집니다 */
const PAGE_SIZE = 30

/**
 * 향수 (A33 — 상단 메뉴 [향수] 목적지)
 *
 * 조건을 하나도 보내지 않으면 백엔드가 활성 향수 전체를 돌려줍니다. 위 줄
 * 필터(ranking)는 **전체 사용자 집계** 기준이라 로그인이 필요 없습니다.
 *
 * TODO: 스크롤 이어서 로드(무한 스크롤). 백엔드 페이지네이션은 준비돼 있어
 * useInfiniteQuery 로 바꾸면 됩니다 — 지금은 첫 페이지만 불러옵니다.
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

      {/* 헤더에 검색창이 없고 검색은 각 페이지 안에 있다는 와이어프레임 규칙 */}
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
