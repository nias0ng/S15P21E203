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
import { readPage, withQueryParams, writePage } from '@/shared/lib/queryParams'
import { Button } from '@/shared/ui/Button'
import { Pagination } from '@/shared/ui/Pagination'
import { GLASS_PANEL } from '@/shared/ui/panel'
import { PillFilter } from '@/shared/ui/PillFilter'
import { SearchField, SEARCH_FIELD_LIST_WIDTH } from '@/shared/ui/SearchField'

/**
 * 한 쪽에 깔 브랜드 수. **5열 × 6줄**이라 30 입니다.
 *
 * 쪽을 나누는 이유는 브랜드가 7,793개이기 때문입니다. 전에는 전부를 한 번에
 * 그려서 카드가 7,793장 생겼고, 그게 화면이 느린 진짜 이유였습니다.
 *
 * ⚠️ **자르는 일은 화면이 합니다.** 브랜드 목록 API 에는 쪽이 없어서(types.ts)
 * 응답은 여전히 전부 옵니다 — 받는 시간은 이걸로 줄지 않고, 그리는 시간만 줍니다.
 * 백엔드에 쪽이 붙으면 이 자르기를 걷고 `brandListQuery` 에 page 를 넘기세요.
 */
const PAGE_SIZE = 30

/**
 * 브랜드 (와이어프레임 A34 — 상단 메뉴 [브랜드] 목적지)
 *
 * 구성은 향수 목록(A33)과 한 벌입니다 — 어두운 방 · 가운데 검색창 · 알약 필터 ·
 * 유리판 위 격자. 두 화면은 상단 메뉴에서 바로 오가는 사이라 서로 다른 모양이면
 * 메뉴를 누를 때마다 화면이 뒤집힙니다. 어둠을 까는 자리는 `app/layouts/RootLayout`
 * 이고, 유리판·알약의 생김새는 `styles/scent-display.css` 에 있습니다.
 *
 * 검색어 · 정렬 · 쪽 번호를 URL 쿼리에 둡니다. 새로고침 · 뒤로가기 · 링크 공유가
 * 같은 결과를 보여주게 하려는 것입니다.
 */
export default function BrandListPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const keyword = searchParams.get('keyword') ?? ''
  const sort =
    (searchParams.get('sort') as BrandSort | null) ?? DEFAULT_BRAND_SORT
  const page = readPage(searchParams)

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
    // 조건이 바뀌면 첫 쪽으로 돌아갑니다 — 200쪽을 보다 검색하면 빈 화면이 됩니다
    setSearchParams(
      writePage(withQueryParams(searchParams, { [key]: value }), 0),
    )
  }

  const goToPage = (next: number) => {
    setSearchParams(writePage(searchParams, next))
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

      {/*
        유리판. 격자와 쪽 번호가 이 판 위에 놓입니다 — 어두운 방 안의 밝은 표면이라
        판 안쪽은 색 토큰이 다시 밝은 화면 값으로 돌아갑니다
        (styles/scent-display.css 의 .scent-glass).
      */}
      <section className={GLASS_PANEL}>
        <div className="mb-6.25 flex items-baseline gap-2.5">
          <h2 className="text-ink font-serif text-2xl">
            {keyword ? `'${keyword}' 검색 결과` : '전체 브랜드'}
          </h2>
          {/* 불러오는 중에는 아예 적지 않습니다 — 0 이 잠깐 보였다 바뀌면 눈에 띕니다 */}
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
