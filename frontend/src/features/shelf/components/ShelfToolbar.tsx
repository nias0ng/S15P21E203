import { useId } from 'react'

import { cn } from '@/shared/lib/cn'

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
  counts,
  value,
  onChange,
  keyword,
  onKeywordChange,
  action,
  className,
}: Props) {
  const searchInputId = useId()

  return (
    <div
      className={cn(
        'flex flex-col gap-2.5 lg:flex-row lg:items-center',
        className,
      )}
    >
      {/*
        칩 줄. 넓은 화면에서는 검색창과 한 줄에 서고, 좁은 화면(쌓는 배치)에서는
        검색창 위 한 줄로 올라가 넘치면 옆으로 밉니다. 칩을 두 줄로 접으면 "벽의 세 칸" 이
        한눈에 안 읽힙니다. 옆으로 밀리는 줄은 포커스 링(4px)을 자르므로 그만큼 안쪽 여백을
        두고 바깥 여백으로 되돌립니다.

        **넓은 화면에서 폭을 510 으로 못 박고 칩을 오른쪽 끝에 붙입니다.**
        검색창이 `lg:flex-1` 이라 이 줄이 좁아진 만큼 그대로 왼쪽으로 자랍니다 —
        여기 있던 향 계열 · 정렬 드롭다운을 걷어내자 검색창이 150px 앞으로 나와
        머리말 쪽으로 밀려났습니다. 이 줄이 그 폭(드롭다운이 있던 508 을 0/5 로 맞춘
        510)을 계속 차지하면 검색창은 있던 자리에 그대로 섭니다. 칩은 그 안에서
        오른쪽 끝, 즉 검색창 옆에 붙습니다.
      */}
      <div className="-m-1 flex [scrollbar-width:none] items-center gap-2.5 overflow-x-auto p-1 lg:m-0 lg:w-[510px] lg:justify-end lg:overflow-visible lg:p-0">
        {/*
        칩이 곧 진열대 벽의 세 칸입니다. 라벨을 여기 적지 않고 SHELF_CATEGORIES 에서
        끌어옵니다 — 예전에는 목업 문구를 옮겨 적어서 저장 모달의 "시향해 봄" 을
        여기서는 "시향 기록" 이라고 부르고 있었습니다.

        칩은 거르지 않습니다. 세 칸이 벽에 모두 이어 서 있고, 칩을 누르면 그 칸의
        첫머리로 벽이 흐릅니다. 켜진 칩은 지금 창 가운데에 걸린 칸입니다 — 휠로 벽을
        흘리면 칩도 따라 켜집니다.

        role="tablist" 가 아니라 그냥 group 입니다. 탭 패널처럼 id 로 이어붙인 구조가
        아니고, 벽을 휠로도 옮길 수 있어서 탭 규약(좌우 화살표로 이동 · aria-controls)을
        온전히 지킬 수 없습니다. 못 지킬 규약을 이름만 빌려 쓰면 낭독기가 더 헷갈립니다.
      */}
        <div
          role="group"
          aria-label="진열대 분류"
          className="flex shrink-0 gap-2.5"
        >
          {SHELF_CATEGORIES.map((chip) => {
            const selected = value === chip.value

            return (
              <button
                key={chip.value}
                type="button"
                // 켜짐을 aria-pressed 로 알립니다. 늘 하나는 켜져 있고(창 가운데 칸),
                // 같은 칩을 다시 누르면 그 칸의 첫머리로 다시 갑니다.
                aria-pressed={selected}
                onClick={() => onChange(chip.value)}
                className={cn(
                  FIELD,
                  // 좌우 25 — 시안은 15 인데, 옆에 있던 드롭다운이 빠지면서 이 셋만
                  // 남아 줄이 헐거워 보입니다. 한 단 넓혀 칩이 검색창과 무게를 맞춥니다.
                  'text-caption flex shrink-0 items-center gap-2.5 px-6.25 whitespace-nowrap',
                  // 켜진 칩은 테두리가 아니라 **채움**으로 표시합니다. 시안의 종이
                  // 위에서 테두리 한 줄은 눈에 안 띄고, 무엇보다 켜질 때만 테두리가
                  // 생기면 칩 높이가 뛰면서 줄 전체가 흔들립니다.
                  selected && 'shelf-field-active',
                )}
              >
                <span className="font-medium">{chip.label}</span>
                {/*
                개수는 라벨보다 한 단계 뒤로 물립니다. 켜진 칩에서는 바탕이 어두워
                보조 글자색이 안 읽히므로, 굵기만 남기고 색은 바탕에 맡깁니다.
              */}
                <span className={selected ? 'opacity-70' : 'shelf-muted'}>
                  {counts[chip.value]}
                </span>
              </button>
            )
          })}
        </div>

        {/*
          칩과 검색창을 눈으로 갈라주는 선. "어느 칸을 보는가"(칩)와 "무엇을
          찾는가"(검색)는 하는 일이 달라서, 둘이 10px 만 띄고 붙어 있으면 네 번째
          칩처럼 읽힙니다.

          좌우 20 씩 띄워 선이 두 덩이 한가운데 섭니다 — 줄의 flex gap(10)이 더해져
          실제로는 칩에서 30, 검색창에서 30 입니다. 이 선도 칩 줄(510) 안에 들어가
          있어서 검색창은 있던 자리에 그대로 서고, 칩만 그만큼 왼쪽으로 물러납니다.

          좁은 화면에서는 칩 줄이 검색창 **위**로 올라가 둘이 위아래로 서므로 세로선이
          가를 것이 없습니다. 그때는 숨깁니다.
        */}
        <span
          aria-hidden
          className="shelf-hairline mx-5 hidden h-6.25 w-px shrink-0 lg:block"
        />
      </div>

      {/*
        포커스 링을 input 이 아니라 이 알약에 겁니다. input 에 걸면 링이
        돋보기 아이콘을 뺀 안쪽에 네모로 그려져 테두리와 따로 놉니다.
        has-[:focus-visible] 라서 마우스 클릭에는 안 뜨고 키보드에만 뜹니다.
      */}
      <label
        htmlFor={searchInputId}
        className={cn(
          FIELD,
          'flex items-center gap-2.5 rounded-full px-3.75 lg:flex-1',
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
          placeholder="향수 이름, 브랜드, 노트를 검색해보세요."
          // 알약이 바탕을 이미 그리고 있어 input 은 투명하게 얹습니다.
          // min-w-0 이 없으면 placeholder 길이만큼 폭을 우겨서 줄이 넘칩니다.
          className="text-body w-full min-w-0 bg-transparent outline-none placeholder:text-[var(--shelf-ink-soft)]"
        />
      </label>

      {/*
        검색창(flex-1) 다음에 두어 줄 오른쪽 끝에 섭니다. shrink-0 이라 창이 좁아져도
        글자가 접히지 않고, 좁은 화면에서는 줄이 세로로 쌓이며 맨 아래로 갑니다.
      */}
      {action && <div className="shrink-0">{action}</div>}
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
