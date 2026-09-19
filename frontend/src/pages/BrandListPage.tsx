import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router'

import {
  BRAND_SORTS,
  BrandGrid,
  brandListQuery,
  DEFAULT_BRAND_SORT,
  type BrandSort,
} from '@/features/brand'
import { cn } from '@/shared/lib/cn'
import { Button } from '@/shared/ui/Button'
import { Pagination } from '@/shared/ui/Pagination'
import { GLASS_PANEL } from '@/shared/ui/panel'
import { PillFilter } from '@/shared/ui/PillFilter'
import { SearchField, SEARCH_FIELD_LIST_WIDTH } from '@/shared/ui/SearchField'

/**
 * 한 쪽에 깔 브랜드 수. 쪽을 나누는 것은 브랜드가 7,793개라 전부 그리면 카드가
 * 7,793장 생겨서입니다.
 *
 * ⚠️ **자르는 일은 화면이 합니다** — 목록 API 에 쪽이 없어 응답은 전부 옵니다.
 * 백엔드에 쪽이 붙으면 자르기를 걷고 `brandListQuery` 에 page 를 넘기세요.
 */
const PAGE_SIZE = 30

/**
 * 브랜드 (A34 — 상단 메뉴 [브랜드] 목적지). 검색어 · 정렬 · 쪽 번호는 URL 쿼리에
 * 둡니다. 어두운 방 · 유리판 구성 — docs/어두운-방-유리판.md
 */
export default function BrandListPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const keyword = searchParams.get('keyword') ?? ''
  const sort =
    (searchParams.get('sort') as BrandSort | null) ?? DEFAULT_BRAND_SORT
  // 주소에는 1부터 세는 번호가 적혀 있고 안에서는 0부터 셉니다(Pagination 과 같습니다)
  const page = Math.max(0, Number(searchParams.get('page') ?? 1) - 1)

  const { data, isPending } = useQuery(brandListQuery({ keyword, sort }))
  const brands = data ?? []

  /*
    주소로 `?page=999` 처럼 범위 밖을 열 수 있어 마지막 쪽으로 당깁니다.
    안 당기면 빈 격자가 뜨는데, 자료가 없는 것과 구분이 안 됩니다.
  */
  const lastPage = Math.max(0, Math.ceil(brands.length / PAGE_SIZE) - 1)
  const safePage = Math.min(page, lastPage)
  const shown = brands.slice(
    safePage * PAGE_SIZE,
    safePage * PAGE_SIZE + PAGE_SIZE,
  )

  const hasFilter = keyword !== '' || sort !== DEFAULT_BRAND_SORT

  const setParam = (key: 'keyword' | 'sort', value: string | null) => {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value)
    else next.delete(key)
    // 조건이 바뀌면 첫 쪽으로 돌아갑니다 — 200쪽을 보다 검색하면 빈 화면이 됩니다
    next.delete('page')
    setSearchParams(next)
  }

  const goToPage = (next: number) => {
    const params = new URLSearchParams(searchParams)
    // 첫 쪽은 주소에 적지 않습니다 — `?page=1` 이 붙은 주소와 안 붙은 주소가 갈립니다
    if (next <= 0) params.delete('page')
    else params.set('page', String(next + 1))
    setSearchParams(params)
    // 쪽을 넘기면 격자 꼭대기로 올립니다. 그대로 두면 6줄 아래에서 다음 쪽이 시작됩니다
    window.scrollTo({ top: 0 })
  }

  return (
    <div className="space-y-3.75">
      <h1 className="sr-only">브랜드</h1>

      {/*
        헤더에 검색창이 없고 검색은 각 페이지 안에 있다는 와이어프레임 규칙.
        향수 목록과 **같은 폭 · 같은 자리**에 둡니다 — 상단 메뉴로 두 화면을 오갈 때
        검색창이 움직이면 같은 자리를 두 번 겨냥하게 됩니다.
      */}
      <SearchField
        className={cn(SEARCH_FIELD_LIST_WIDTH, 'mx-auto w-full')}
        label="브랜드명으로 검색"
        placeholder="브랜드명으로 검색해주세요."
        defaultValue={keyword}
        key={keyword}
        onSearch={(next) => setParam('keyword', next.trim() || null)}
      />

      {/*
        정렬은 **늘 하나가 켜져 있어야** 해서 `required` 입니다. 향수 쪽 알약은
        해제가 있지만(= 필터 안 검), 정렬은 꺼지면 줄 세울 기준이 없어집니다.
      */}
      <PillFilter
        label="브랜드 정렬"
        options={BRAND_SORTS}
        value={sort}
        onChange={(next) => setParam('sort', next)}
        required
        className="flex-wrap justify-center"
      />

      <section className={GLASS_PANEL}>
        <div className="mb-6.25 flex items-baseline gap-2.5">
          <h2 className="text-ink font-serif text-2xl">
            {keyword ? `'${keyword}' 검색 결과` : '전체 브랜드'}
          </h2>
          {!isPending && brands.length > 0 && (
            <span className="text-ink-muted text-caption">
              {brands.length}개
            </span>
          )}
        </div>

        <BrandGrid
          items={shown}
          isPending={isPending}
          skeletonCount={PAGE_SIZE}
          emptyAction={
            hasFilter && (
              <Button variant="outline" onClick={() => setSearchParams({})}>
                초기화
              </Button>
            )
          }
        />

        <Pagination
          className="mt-6.25"
          label="브랜드 페이지"
          page={safePage}
          size={PAGE_SIZE}
          totalElements={brands.length}
          onPageChange={goToPage}
        />
      </section>
    </div>
  )
}
