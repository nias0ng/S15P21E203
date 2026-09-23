import { useId } from 'react'

import { cn } from '@/shared/lib/cn'

type Props = {
  keyword: string
  onKeywordChange: (next: string) => void
  /**
   * 줄 오른쪽 끝에 붙는 조작. 지금은 [+ 향수 등록] 입니다.
   *
   * 진열대에 담는 단추라 진열대를 다루는 이 줄에 섭니다. 예전에는 "내 컬렉션"
   * 머리말에 있었는데, 그쪽은 무대를 바꿔야 나오는 자리라 진열대를 보는 동안에는
   * 화면에 없었습니다 — 담을 방법이 안 보이는 진열대였습니다.
   *
   * 도메인이 아니라 화면에서 넘기는 이유: 누를 때 무엇을 할지(로그인 유도냐 등록
   * 모달이냐)는 화면이 아는 일입니다.
   */
  action?: React.ReactNode
  /**
   * 좁은 기둥 안에 세로로 세우는 배치. 검색창과 조작이 위아래로 서고 둘 다 받은 폭을
   * 꽉 채웁니다. 주지 않으면 넓은 화면에서 한 줄로 섭니다.
   */
  stacked?: boolean
  className?: string
}

/**
 * 칩 · 검색창의 공통 치수. 시안 실측(높이 42px · 모서리 8px)입니다.
 *
 * 높이를 h-10 로 못 박은 이유: 칩과 검색창이 한 줄에 서는데 각자
 * 안쪽 여백으로 높이를 만들면 글자 길이에 따라 1~2px 씩 어긋나 줄이 흔들립니다.
 *
 * 색·그림자는 `../shelf-display.css` 의 `.shelf-field` 가 냅니다 —
 * 위쪽 1px 하이라이트가 종이에서 살짝 솟은 느낌을 만드는데, 그 표현은
 * 유틸리티로 옮기면 읽히지 않습니다.
 */
const FIELD =
  'shelf-field h-10 rounded-lg transition-colors duration-120 ease-out ' +
  'focus-visible:ring-2 focus-visible:ring-[var(--shelf-ink)] focus-visible:ring-offset-2 ' +
  'focus-visible:ring-offset-[var(--paper)] outline-none'

/**
 * 진열대 머리말 옆 도구 줄 (와이어프레임 A13 — 진열장 시안)
 *
 * 분류 칩과 검색창이 한 줄에 놓입니다. 진열대를 다루는 줄이라 이름이 Filters 가
 * 아니라 Toolbar 입니다 — 칸으로 가기(칩)와 거르기(검색)가 한 줄에 같이 있습니다.
 *
 * 향 계열 · 정렬 드롭다운이 여기 있었는데 걷어냈습니다. 진열대 API 에 두 파라미터가
 * 없어 열어도 고를 게 없는 disabled 단추였고, 자리만 차지했습니다. 거르기와 정렬이
 * 실제로 붙어 있는 곳은 향수 목록(`features/perfume`)이라 거기 것을 참고하면 됩니다.
 * 검색창만 flex-1 이라 창 폭이 변해도 칩은 안 밀리고 검색창이 늘고 줄어듭니다.
 * 칩이 밀리면 "지금 벽의 어느 칸을 보고 있는지"가 화면 밖으로 나가버립니다.
 */
export function ShelfToolbar({
  keyword,
  onKeywordChange,
  action,
  stacked = false,
  className,
}: Props) {
  const searchInputId = useId()

  return (
    <div
      className={cn(
        'flex flex-col gap-2.5',
        stacked ? 'lg:items-stretch' : 'lg:flex-row lg:items-center',
        className,
      )}
    >
      {/*
        분류 칩 셋(보유 중 · 시향해 봄 · 보유 희망)은 **진열대 벽의 왼쪽 현판 메뉴로 내려갔습니다**
        (S15P21E203-417). 벽감이 창에 고정이라 한 번에 한 분류만 서고, 분류를 갈아끼우는 손잡이가
        벽 옆에 붙어 있는 편이 무엇을 바꾸는 단추인지 분명합니다. 칩과 현판이 둘 다 있으면 같은 일을
        하는 손잡이가 한 화면에 두 벌이 됩니다.

        칩을 가르던 세로선도 같이 걷었습니다 — 가를 것이 없습니다.
      */}

      {/*
        포커스 링을 input 이 아니라 이 알약에 겁니다. input 에 걸면 링이
        돋보기 아이콘을 뺀 안쪽에 네모로 그려져 테두리와 따로 놉니다.
        has-[:focus-visible] 라서 마우스 클릭에는 안 뜨고 키보드에만 뜹니다.
      */}
      <label
        htmlFor={searchInputId}
        className={cn(
          FIELD,
          'flex items-center gap-2.5 rounded-full px-3.75',
          stacked ? 'w-full' : 'lg:flex-1',
          'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--shelf-ink)]',
          'has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-[var(--paper)]',
        )}
      >
        <SearchIcon />
        <span className="sr-only">향수 검색</span>
        <input
          id={searchInputId}
          type="search"
          value={keyword}
          onChange={(event) => onKeywordChange(event.target.value)}
          placeholder={
            stacked ? '향수 검색' : '향수 이름, 브랜드, 노트를 검색해보세요.'
          }
          // 알약이 바탕을 이미 그리고 있어 input 은 투명하게 얹습니다.
          // min-w-0 이 없으면 placeholder 길이만큼 폭을 우겨서 줄이 넘칩니다.
          className="text-body w-full min-w-0 bg-transparent outline-none placeholder:text-[var(--shelf-ink-soft)]"
        />
      </label>

      {/*
        검색창(flex-1) 다음에 두어 줄 오른쪽 끝에 섭니다. shrink-0 이라 창이 좁아져도
        글자가 접히지 않고, 좁은 화면에서는 줄이 세로로 쌓이며 맨 아래로 갑니다.
      */}
      {action && (
        <div className={cn('shrink-0', stacked && '[&>*]:h-10 [&>*]:w-full')}>
          {action}
        </div>
      )}
    </div>
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
      className="shelf-muted size-3.75 shrink-0"
    >
      <circle cx="7" cy="7" r="4.5" />
      <path d="m10.5 10.5 3 3" />
    </svg>
  )
}
