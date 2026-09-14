import { useId } from 'react'

import { cn } from '@/shared/lib/cn'
import { SearchIcon } from '@/shared/ui/SearchIcon'

import {
  SHELF_CATEGORIES,
  type ShelfCategory,
  type ShelfCounts,
} from '../types'

type Props = {
  counts: ShelfCounts
  value: ShelfCategory
  onChange: (next: ShelfCategory) => void
  keyword: string
  onKeywordChange: (next: string) => void
  className?: string
}

/**
 * 칩 · 검색창의 공통 치수. 시안 실측입니다.
 *
 * 높이를 못 박은 이유: 칩·드롭다운·검색창이 한 줄에 서는데 각자 안쪽 여백으로
 * 높이를 만들면 글자 길이에 따라 어긋나 줄이 흔들립니다.
 * 색·그림자는 `../shelf-display.css` 의 `.shelf-field` 가 냅니다.
 */
const FIELD =
  'shelf-field h-[42px] rounded-lg transition-colors duration-120 ease-out ' +
  'focus-visible:ring-2 focus-visible:ring-[var(--shelf-ink)] focus-visible:ring-offset-2 ' +
  'focus-visible:ring-offset-[var(--paper)] outline-none'

/**
 * 진열대 머리말 옆 도구 줄 (와이어프레임 A13 — 진열장 시안)
 *
 * 왼쪽부터 분류 칩 → 구분선 → 드롭다운 → 검색창 순으로 한 줄에 놓입니다.
 * 진열장에 무엇을 세울지 정하는 줄이라 이름이 Filters 가 아니라 Toolbar 입니다 —
 * 거르기(칩·검색)와 정렬이 한 줄에 같이 있습니다.
 * 검색창만 flex-1 이라 창 폭이 변해도 칩은 안 밀리고 검색창이 늘고 줄어듭니다.
 * 칩이 밀리면 "지금 무엇으로 걸러져 있는지"가 화면 밖으로 나가버립니다.
 */
export function ShelfToolbar({
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
      {/*
        칩이 곧 진열장의 세 칸입니다. 라벨은 SHELF_CATEGORIES 에서 끌어옵니다.

        role="tablist" 가 아니라 group 인 이유: 탭 패널처럼 id 로 이어붙인 구조가
        아니고 진열장에 휠로도 들어올 수 있어서 탭 규약(좌우 화살표 이동 ·
        aria-controls)을 온전히 지킬 수 없습니다. 못 지킬 규약을 이름만 빌려 쓰면
        낭독기가 더 헷갈립니다.
      */}
      <div role="group" aria-label="진열대 분류" className="flex gap-2">
        {SHELF_CATEGORIES.map((chip) => {
          const selected = value === chip.value

          return (
            <button
              key={chip.value}
              type="button"
              // 항상 하나는 켜진 필터라 같은 칩을 다시 눌러도 해제되지 않습니다
              aria-pressed={selected}
              onClick={() => onChange(chip.value)}
              className={cn(
                FIELD,
                'text-caption flex items-center gap-2 px-4',
                // 테두리가 아니라 채움으로 표시합니다 — 켜질 때만 테두리가 생기면
                // 칩 높이가 뛰면서 줄 전체가 흔들립니다
                selected && 'shelf-field-active',
              )}
            >
              <span className="font-medium">{chip.label}</span>
              {/* 켜진 칩은 바탕이 어두워 보조 글자색이 안 읽히므로 투명도로 물립니다 */}
              <span className={selected ? 'opacity-70' : 'shelf-muted'}>
                {counts[chip.value]}
              </span>
            </button>
          )
        })}
      </div>

      {/* 거르는 것(칩)과 정렬·검색을 눈으로 갈라주는 선 */}
      <span aria-hidden className="shelf-hairline mx-2 h-6 w-px" />

      <FilterDropdown label="향 계열" />
      <FilterDropdown label="정렬" />

      {/*
        포커스 링을 input 이 아니라 이 알약에 겁니다 — input 에 걸면 링이 돋보기를
        뺀 안쪽에 네모로 그려져 테두리와 따로 놉니다.
      */}
      <label
        htmlFor={searchInputId}
        className={cn(
          FIELD,
          'flex flex-1 items-center gap-2 rounded-full px-4',
          'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--shelf-ink)]',
          'has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-[var(--paper)]',
        )}
      >
        <SearchIcon className="shelf-muted size-4 shrink-0" />
        <span className="sr-only">향수 검색</span>
        <input
          id={searchInputId}
          type="search"
          value={keyword}
          onChange={(event) => onKeywordChange(event.target.value)}
          placeholder="향수 이름, 브랜드, 노트를 검색해보세요."
          // min-w-0 이 없으면 placeholder 길이만큼 폭을 우겨서 줄이 넘칩니다
          className="text-body w-full min-w-0 bg-transparent outline-none placeholder:text-[var(--shelf-ink-soft)]"
        />
      </label>
    </div>
  )
}

/**
 * 향 계열 · 정렬 드롭다운.
 *
 * ⚠️ 목록 API 에 향 계열 필터와 정렬 파라미터가 아직 없어 **disabled 로 두었습니다.**
 * 자리를 비우지 않는 이유는 칸이 생길 때 검색창 폭이 줄어드는 변화를 미리 보기
 * 위해서입니다. 파라미터가 생기면 disabled 를 걷고 목록만 붙이면 됩니다.
 *
 * 켜졌을 때의 모양을 바탕 클래스에 두고 꺼진 모양만 disabled: 로 덮습니다.
 * 반대로 하면 disabled 를 걷는 사람이 스타일을 새로 짜다 포커스 링을 빠뜨립니다.
 */
function FilterDropdown({ label }: { label: string }) {
  return (
    <button
      type="button"
      disabled
      aria-haspopup="listbox"
      aria-expanded={false}
      className={cn(
        FIELD,
        'text-caption flex items-center gap-2 px-4',
        // 공통 Disabled 규칙(UI 명세 2장) — 채움을 없애고 윤곽만 남깁니다
        'disabled:pointer-events-none disabled:bg-transparent disabled:opacity-40 disabled:shadow-none',
      )}
    >
      {label}
      <span aria-hidden>▾</span>
    </button>
  )
}
