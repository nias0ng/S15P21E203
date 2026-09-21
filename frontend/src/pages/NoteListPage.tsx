import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router'

import {
  filterByFamily,
  NoteCategorySections,
  noteFamiliesQuery,
  noteListQuery,
} from '@/features/note'
import { useDiveReady } from '@/shared/hooks/useDiveReady'
import { cn } from '@/shared/lib/cn'
import { withQueryParams } from '@/shared/lib/queryParams'
import { Button } from '@/shared/ui/Button'
import { PillFilter } from '@/shared/ui/PillFilter'
import { SearchField, SEARCH_FIELD_LIST_WIDTH } from '@/shared/ui/SearchField'

/**
 * 노트 (A35). 대분류로 묶어 세로로 쌓고 순서는 고정이며, 검색어와 대분류는 URL
 * 쿼리에 둡니다. 어두운 방 · 유리판 — docs/어두운-방-유리판.md (판이 묶음마다 한 장)
 */
export default function NoteListPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const keyword = searchParams.get('keyword') ?? ''
  const family = searchParams.get('family')

  const { data, isPending } = useQuery(noteListQuery(keyword))
  const { data: families } = useQuery(noteFamiliesQuery)

  /*
   * 메인에서 잠수로 들어왔으면 커튼이 짙은 바다색으로 덮은 채 이 신호를 기다립니다
   * (안 알려도 상한에 걷힙니다 — `shared/ui/DiveCurtain`). 잠수로 들어온 것이 아니면
   * 아무 일도 안 일어납니다.
   *
   * 기준은 **목록**입니다 — 아래에서 스피너가 갈리는 바로 그 조건입니다. 목록이 칠해지면
   * 이 화면은 다 선 것이고, 여기는 진열대처럼 뒤늦게 떠오르는 사진 벽이 없습니다.
   *
   * ⚠ 대분류(`families`)는 안 기다립니다. 없으면 알약을 아예 안 그리므로(아래) 늦게 와도
   *   목록 위에 한 줄이 **더해질** 뿐입니다 — 그걸 기다리면 커튼이 알약 때문에 서 있게 됩니다.
   */
  useDiveReady(!isPending)

  /*
    검색어는 `noteListQuery` 의 select 가 이미 걸렀습니다. 대분류는 여기서 겹쳐
    겁니다 — 둘 다 캐시된 같은 목록 위에서 하는 일이라 요청이 늘지 않습니다.
  */
  const shown = filterByFamily(data ?? [], family)
  const hasFilter = keyword !== '' || family !== null

  const setParam = (key: 'keyword' | 'family', value: string | null) => {
    setSearchParams(withQueryParams(searchParams, { [key]: value }))
  }

  return (
    <div className="space-y-3.75">
      <h1 className="sr-only">노트</h1>

      {/*
        헤더에 검색창이 없고 검색은 각 페이지 안에 있다는 와이어프레임 규칙.
        향수 목록 · 브랜드와 **같은 폭 · 같은 자리**에 둡니다 — 상단 메뉴로 세 화면을
        오갈 때 검색창이 움직이면 같은 자리를 여러 번 겨냥하게 됩니다.
      */}
      <SearchField
        className={cn(SEARCH_FIELD_LIST_WIDTH, 'mx-auto w-full')}
        label="노트명으로 검색"
        placeholder="노트명으로 검색해주세요."
        defaultValue={keyword}
        key={keyword}
        onSearch={(next) => setParam('keyword', next.trim() || null)}
      />

      {/*
        대분류 알약. 정렬과 달리 `required` 가 아닙니다 — "거르지 않음" 이 멀쩡한
        상태입니다. 목록이 오기 전에는 그리지 않습니다.
      */}
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
