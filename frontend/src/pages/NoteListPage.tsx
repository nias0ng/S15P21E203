import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router'

import {
  filterByFamily,
  NoteCategorySections,
  noteFamiliesQuery,
  noteListQuery,
} from '@/features/note'
import { useDiveReady } from '@/shared/hooks/useDiveReady'
import { withQueryParams } from '@/shared/lib/queryParams'
import { Button } from '@/shared/ui/Button'
import { PillFilter } from '@/shared/ui/PillFilter'
import { SearchField, SEARCH_FIELD_LIST_WIDTH } from '@/shared/ui/SearchField'

/**
 * 노트 (A35). 대분류로 묶어 세로로 쌓고 순서는 고정이며, 검색어와 대분류는 URL
 * 쿼리에 둡니다 — docs/어두운-방-유리판.md
 */
export default function NoteListPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const keyword = searchParams.get('keyword') ?? ''
  const family = searchParams.get('family')

  const { data, isPending } = useQuery(noteListQuery(keyword))
  const { data: families } = useQuery(noteFamiliesQuery)

  // 잠수로 들어왔으면 커튼이 이 신호를 기다립니다 — 대분류(`families`)는 늦게 와도
  // 목록 위에 한 줄이 더해질 뿐이라 안 기다립니다
  useDiveReady(!isPending)

  // 검색어는 `noteListQuery` 의 select 가 걸렀고 대분류는 여기서 겹쳐 겁니다 —
  // 둘 다 캐시된 같은 목록 위라 요청이 늘지 않습니다
  const shown = filterByFamily(data ?? [], family)
  const hasFilter = keyword !== '' || family !== null

  const setParam = (key: 'keyword' | 'family', value: string | null) => {
    setSearchParams(withQueryParams(searchParams, { [key]: value }))
  }

  return (
    <div className="space-y-3.75">
      <h1 className="sr-only">노트</h1>

      {/* 향수 목록 · 브랜드와 같은 폭 · 같은 자리입니다 (와이어프레임 규칙) */}
      <SearchField
        className={SEARCH_FIELD_LIST_WIDTH}
        label="노트명으로 검색"
        placeholder="노트명으로 검색해주세요."
        defaultValue={keyword}
        key={keyword}
        onSearch={(next) => setParam('keyword', next.trim() || null)}
      />

      {/* 브랜드 정렬과 달리 `required` 가 아닙니다 — "거르지 않음" 이 멀쩡한 상태입니다 */}
      {families && families.length > 0 && (
        <PillFilter
          label="노트 대분류"
          options={families.map((value) => ({ value, label: value }))}
          value={family}
          onChange={(next) => setParam('family', next)}
          className="flex-wrap justify-center"
        />
      )}

      <NoteCategorySections
        notes={shown}
        isPending={isPending}
        emptyAction={
          hasFilter && (
            <Button variant="outline" onClick={() => setSearchParams({})}>
              초기화
            </Button>
          )
        }
      />
    </div>
  )
}
