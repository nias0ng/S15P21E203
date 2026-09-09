import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router'

import {
  BRAND_SORTS,
  BrandGrid,
  brandListQuery,
  type BrandSort,
} from '@/features/brand'
import { Button } from '@/shared/ui/Button'
import { ChipToggle } from '@/shared/ui/ChipToggle'
import { SearchField } from '@/shared/ui/SearchField'

/**
 * 브랜드 (와이어프레임 A34 — 상단 메뉴 [브랜드] 목적지)
 *
 * 와이어프레임 주석:
 * - 기본 정렬은 abc 순 — 한글 브랜드는 로마자 표기 기준으로 끼워 넣는다
 * - 브랜드를 누르면 그 브랜드의 향수 목록 (A33 에 브랜드 필터가 걸린 상태)
 *
 * 검색어와 정렬을 URL 쿼리에 둡니다. 새로고침 · 뒤로가기 · 링크 공유가 같은
 * 결과를 보여주게 하려는 것입니다.
 */
export default function BrandListPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const keyword = searchParams.get('keyword') ?? ''
  const sort = (searchParams.get('sort') as BrandSort | null) ?? 'NAME'

  const { data, isPending } = useQuery(brandListQuery({ keyword, sort }))

  const updateParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value)
    else next.delete(key)
    setSearchParams(next)
  }

  return (
    <div className="space-y-4">
      <h1 className="sr-only">브랜드</h1>

      <SearchField
        label="브랜드명으로 검색"
        placeholder="브랜드명으로 검색"
        defaultValue={keyword}
        key={keyword}
        onSearch={(next) => updateParam('keyword', next.trim() || null)}
      />

      <div className="flex items-center gap-3">
        <span className="text-ink-muted text-caption">정렬</span>
        <ChipToggle
          label="브랜드 정렬"
          options={BRAND_SORTS}
          value={sort}
          // 정렬은 항상 하나가 켜져 있어야 하므로 해제(null)를 기본값으로 되돌립니다
          onChange={(next) => updateParam('sort', next ?? 'NAME')}
        />
      </div>

      <hr className="border-line" />

      <BrandGrid
        items={data ?? []}
        isPending={isPending}
        emptyAction={
          (keyword !== '' || sort !== 'NAME') && (
            <Button variant="outline" onClick={() => setSearchParams({})}>
              초기화
            </Button>
          )
        }
      />
    </div>
  )
}
