import { useId } from 'react'

import { cn } from '@/shared/lib/cn'

import type { ShelfCategory } from '../types'

/**
 * 컬렉션 목록을 거르는 기준. 'ALL' 만 진열대 분류가 아닌 "안 거름" 상태입니다.
 *
 * 문자열을 직접 나열하지 않고 ShelfCategory 를 얹은 이유: 분류가 늘어나면
 * types.ts 한 곳만 고쳐도 여기까지 따라옵니다. 반대로 나열해두면 분류를 추가한
 * 사람이 이 파일을 못 찾아 칩만 조용히 빠집니다.
 *
 * 이 값을 들고 있는 쪽은 화면(pages)이라 타입도 함께 내보냅니다. 안 내보내면
 * 호출하는 쪽이 useState<'ALL' | ShelfCategory> 로 같은 유니온을 또 적게 되고,
 * 그러면 위에 적은 "한 곳만 고치면 된다" 가 곧바로 깨집니다.
 */
export type CollectionFilterValue = 'ALL' | ShelfCategory

type CollectionCounts = {
  all: number
  owned: number
  tried: number
  wish: number
}

type Props = {
  counts: CollectionCounts
  value: CollectionFilterValue
  onChange: (next: CollectionFilterValue) => void
  keyword: string
  onKeywordChange: (next: string) => void
  className?: string
}

/**
 * 칩 정의.
 *
 * 라벨이 SHELF_CATEGORIES 와 다릅니다(시향해 봄 → 시향 기록, 보유 희망 → 위시리스트).
 * 목업의 문구를 그대로 옮긴 것인데, 같은 값을 화면마다 다르게 부르는 셈이라
 * 팀 확정 후 한쪽으로 맞춰야 합니다.
 */
const FILTER_CHIPS = [
  { value: 'ALL', label: '전체', countKey: 'all' },
  { value: 'OWNED', label: '보유 중', countKey: 'owned' },
  { value: 'TRIED', label: '시향 기록', countKey: 'tried' },
  { value: 'WISH', label: '위시리스트', countKey: 'wish' },
] as const satisfies readonly {
  value: CollectionFilterValue
  label: string
  countKey: keyof CollectionCounts
}[]

/**
 * 컬렉션 목록 위 필터 줄 (와이어프레임 A13 컬렉션 영역)
 *
 * 왼쪽부터 분류 칩 → 구분선 → 드롭다운 → 검색창 순으로 한 줄에 놓입니다.
 * 검색창만 flex-1 이라 창 폭이 변해도 칩은 안 밀리고 검색창이 늘고 줄어듭니다.
 * 칩이 밀리면 "지금 무엇으로 걸러져 있는지"가 화면 밖으로 나가버립니다.
 */
export function CollectionFilters({
  counts,
  value,
  onChange,
  keyword,
  onKeywordChange,
  className,
}: Props) {
  const searchInputId = useId()

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {/* aria-pressed 만으로는 이 칩들이 한 묶음인 걸 낭독기가 모릅니다 */}
      <div role="group" aria-label="컬렉션 분류" className="flex gap-2">
        {FILTER_CHIPS.map((chip) => {
          const selected = value === chip.value

          return (
            <button
              key={chip.value}
              type="button"
              // 라디오가 아니라 토글로 읽히도록 aria-pressed 를 씁니다.
              // 같은 칩을 다시 눌러도 해제되지 않는(항상 하나는 켜진) 필터라
              // 해제 동작은 두지 않았습니다 — 'ALL' 이 그 자리를 대신합니다.
              aria-pressed={selected}
              onClick={() => onChange(chip.value)}
              className={cn(
                // 테두리는 두 상태 모두에 둡니다. 선택될 때만 생기면 칩 높이가
                // 2px 뛰면서 줄 전체가 흔들립니다(옆 검색 알약도 테두리가 있어
                // 여기서 높이가 맞춰집니다).
                'text-caption rounded-card flex items-center gap-2 border px-4 py-2',
                'transition-colors duration-120 ease-out',
                'focus-visible:ring-accent-deep outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
                // Selected 는 UI 명세 2장·5장의 채움(bg-ink text-surface)입니다.
                // accent-deep 은 포커스 링 색이라, 선택 칩 바탕으로 쓰면 그 칩에
                // 포커스가 갔을 때 링과 바탕이 같은 색이 되어 링이 사라집니다.
                //
                // 안 고른 칩의 바탕이 surface-card 인 것도 규칙(2장 Default)이자
                // 버그 수정입니다. surface-sunken 과 line-soft 는 둘 다 bone 이라
                // sunken 바탕에서는 hover:bg-line-soft 가 아무 변화도 못 냅니다.
                selected
                  ? 'border-ink bg-ink text-surface'
                  : 'border-line text-ink hover:bg-line-soft bg-surface-card',
              )}
            >
              <span className="font-medium">{chip.label}</span>
              {/*
                개수는 라벨보다 한 단계 뒤로 물립니다. 선택된 칩에서는 바탕이
                ink 라 ink-muted 가 거의 안 읽혀서, 밝은 surface 로 올리고
                위계는 굵기(medium 라벨 / normal 숫자)가 대신 냅니다.
              */}
              <span className={selected ? 'text-surface' : 'text-ink-muted'}>
                {counts[chip.countKey]}
              </span>
            </button>
          )
        })}
      </div>

      {/* 거르는 것(칩)과 정렬·검색을 눈으로 갈라주는 선 */}
      <span aria-hidden className="bg-line mx-2 h-6 w-px" />

      <FilterDropdown label="향 계열" />
      <FilterDropdown label="정렬" />

      {/*
        포커스 링을 input 이 아니라 이 알약에 겁니다. input 에 걸면 링이
        돋보기 아이콘을 뺀 안쪽에 네모로 그려져 테두리와 따로 놉니다.
        has-[:focus-visible] 라서 마우스 클릭에는 안 뜨고 키보드에만 뜹니다.
      */}
      <label
        htmlFor={searchInputId}
        className={cn(
          'border-line bg-surface-card flex flex-1 items-center gap-2 rounded-full border px-4 py-2',
          'has-[:focus-visible]:ring-accent-deep has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-offset-2',
        )}
      >
        <SearchIcon />
        <span className="sr-only">향수 검색</span>
        <input
          id={searchInputId}
          type="search"
          value={keyword}
          onChange={(event) => onKeywordChange(event.target.value)}
          placeholder="향수 이름, 브랜드, 노트를 검색해보세요."
          // 알약이 테두리·바탕을 이미 그리고 있어 input 은 투명하게 얹습니다.
          // min-w-0 이 없으면 placeholder 길이만큼 폭을 우겨서 줄이 넘칩니다.
          className="text-body text-ink placeholder:text-ink-muted w-full min-w-0 bg-transparent outline-none"
        />
      </label>
    </div>
  )
}

/**
 * 향 계열 · 정렬 드롭다운.
 *
 * **눌러도 아무것도 열리지 않게 disabled 로 두었습니다.** 목록 API 에 향 계열
 * 필터와 정렬 파라미터가 아직 없어서(진열대 API 자체가 자리표시자입니다) 열어도
 * 고를 것이 없기 때문입니다. 그래도 자리를 비우지 않는 이유는, 나중에 칸이
 * 생기면서 검색창 폭이 줄어드는 레이아웃 변화를 지금 미리 확인하기 위해서입니다.
 * 파라미터가 생기면 disabled 를 걷고 목록만 붙이면 됩니다.
 *
 * 그래서 켜졌을 때의 모양(기본·호버·포커스)까지 미리 적어두고, 꺼진 모양만
 * disabled: 로 덮습니다. 꺼진 모양을 바탕 클래스에 직접 박아두면 disabled 를
 * 걷는 사람이 스타일까지 새로 짜야 하고, 그때 포커스 링이 조용히 빠집니다.
 */
function FilterDropdown({ label }: { label: string }) {
  return (
    <button
      type="button"
      disabled
      aria-haspopup="listbox"
      aria-expanded={false}
      className={cn(
        'text-caption rounded-card flex items-center gap-2 border px-4 py-2',
        'border-line bg-surface-card text-ink hover:bg-line-soft',
        'transition-colors duration-120 ease-out',
        'focus-visible:ring-accent-deep outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        // 공통 Disabled 규칙(UI 명세 2장) — 채움을 없애고 테두리만 남깁니다.
        // "누를 수 없다"가 색이 아니라 형태로 드러납니다.
        'disabled:text-ink-muted disabled:pointer-events-none disabled:bg-transparent disabled:opacity-40',
      )}
    >
      {label}
      <span aria-hidden>▾</span>
    </button>
  )
}

/**
 * 돋보기.
 *
 * 아이콘 하나 때문에 라이브러리를 붙이지 않습니다. currentColor 라 감싼 쪽의
 * 글자색을 그대로 따라갑니다.
 */
function SearchIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      className="text-ink-muted size-4 shrink-0"
    >
      <circle cx="7" cy="7" r="4.5" />
      <path d="m10.5 10.5 3 3" />
    </svg>
  )
}
