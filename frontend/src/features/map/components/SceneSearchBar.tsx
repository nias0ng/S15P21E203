import { useId, useState } from 'react'

import { cn } from '@/shared/lib/cn'
import { SearchField } from '@/shared/ui/SearchField'

/**
 * 메인 검색이 하는 두 가지 일.
 *
 * `nl`(자연어)이 기본입니다 — 메인 검색창은 "어떤 향을 찾고 계신가요?" 라고 묻는
 * 자리이고, 향수 이름을 이미 아는 사람은 헤더를 거쳐 향수 목록(A33)으로 갑니다.
 */
export type SceneSearchMode = 'nl' | 'normal'

type Props = {
  mode: SceneSearchMode
  onModeChange: (mode: SceneSearchMode) => void
  /** 지금 모드로 검색합니다. 빈 문자열은 오지 않습니다 */
  onSearch: (keyword: string, mode: SceneSearchMode) => void
  className?: string
}

const PLACEHOLDER: Record<SceneSearchMode, string> = {
  // 엔진 검색창(`landing/index.html`)이 쓰던 문구 그대로입니다 — 화면에서 바뀐 것은 자리가 아니라 누가 그리는가입니다
  nl: '어떤 향을 찾고 계신가요?',
  normal: '향수 · 브랜드 이름으로 찾기',
}

const MODE_LABEL: Record<SceneSearchMode, string> = {
  nl: '자연어',
  normal: '이름',
}

/**
 * 3D 향 지도 위의 검색창 (A01 — MAP-01).
 *
 * ⚠️ **엔진이 아니라 앱이 그립니다.** 원래 이 알약은 엔진 페이지
 * (`landing/index.html` 의 `#search-input`) 안에 있었습니다. 검색 방식을 둘로
 * 나누면서 앱으로 올렸습니다 — 방식 전환은 결과 화면(추천 모달 · 향수 상세)을
 * 아는 쪽이 쥐고 있어야 하는데, 엔진은 iframe 안이라 라우터도 모달도 모릅니다.
 * 엔진 쪽 알약은 `ScentScene` 의 `hideEngineSearch` 가 숨깁니다.
 *
 * 그래서 **자리와 크기를 엔진 값에 맞춰 두었습니다**(아래 POSITION · SIZE).
 * 엔진의 설명문구(`#zone-info`)가 검색창 아래 36px 에 서는데, 그 계산은 엔진
 * CSS 변수(`--pb-search-top` · `--pb-search-h`)로 하고 그 변수는 iframe 문서
 * 안에만 있습니다. 앱이 제 마음대로 크기를 정하면 두 글자가 겹칩니다.
 */
export function SceneSearchBar({
  mode,
  onModeChange,
  onSearch,
  className,
}: Props) {
  // 방식을 바꿔도 치던 글은 남깁니다 — 같은 말을 두 방식으로 해보는 것이 이 단추의 쓸모입니다
  const [keyword, setKeyword] = useState('')
  const hintId = useId()

  const other = mode === 'nl' ? 'normal' : 'nl'

  return (
    <div className={cn(POSITION, className)}>
      <SearchField
        label={mode === 'nl' ? '자연어로 향수 추천받기' : '향수 이름으로 찾기'}
        placeholder={PLACEHOLDER[mode]}
        value={keyword}
        onChange={(event) => setKeyword(event.target.value)}
        aria-describedby={hintId}
        className={cn(SIZE, 'pointer-events-auto mx-auto')}
        onSearch={(value) => {
          const trimmed = value.trim()
          if (!trimmed) return
          onSearch(trimmed, mode)
        }}
        leading={
          <button
            type="button"
            onClick={() => onModeChange(other)}
            aria-label={`검색 방식 바꾸기 — 지금은 ${MODE_LABEL[mode]} 검색`}
            className={cn(
              /*
                세로 여백을 넉넉히 둡니다 — 글자만큼(20px)만 두면 누를 자리가 너무 작아
                빗나갑니다(실측). 검색창이 50px 이라 28px 까지는 여유가 있습니다.
              */
              'flex shrink-0 items-center gap-1 rounded-full py-2 pr-2 pl-2.75',
              /*
                알약 안의 알약이라 **한 단 진한 먹색**입니다. 색 토큰(`bg-surface-sunken`)을
                안 쓰는 이유는 감싼 검색창과 같습니다 — 이 알약은 어느 방에 있든 아이보리
                종이 위이고, 의미 토큰은 어두운 방에서 뒤집힙니다 (`SearchField` 주석).
              */
              'bg-charcoal/8 hover:bg-charcoal/14 text-charcoal',
              'text-[11.5px] leading-none font-medium whitespace-nowrap',
              'transition-colors duration-120',
              'focus-visible:ring-accent-deep outline-none focus-visible:ring-2',
            )}
          >
            {MODE_LABEL[mode]}
            <SwapIcon />
          </button>
        }
      />

      {/*
        단추만으로는 **무엇이 바뀌는지** 알 수 없습니다 — 글자가 "자연어" 에서 "이름" 으로
        바뀔 뿐이라, 처음 보는 사람은 그게 방식 이름인지 검색 대상인지 모릅니다.
        한 줄을 알약 아래 붙여 지금 방식이 무엇을 하는지 적습니다.

        ⚠️ 이 줄은 엔진 설명문구(`#zone-info`)보다 **위**에 있어야 합니다. 그쪽은 검색창
          아래 36px 에 서므로(`--pb-info-top` = search-top + search-h + 36) 알약 아래 8px
          에 두면 **남는 틈이 2px 뿐**입니다 — 세 반응형 단계 모두 그렇습니다
          (기본 178~204 vs 206 · 760 이하 152~178 vs 180 · 높이 560 이하 148~174 vs 176).
          이 줄의 글자 크기 · 세로 여백을 키우면 해역에 들어갔을 때 두 글자가 물립니다.
        ⚠️ **글자만 얹으면 안 읽힙니다.** 뒤가 3D 바다라 시간대마다 밝기가 바뀌고
          (노을 · 낮 · 밤), 흰 글자에 그림자를 줘도 노을 하늘에서는 묻힙니다. 검색창과
          같은 아이보리 종이를 한 장 깔아 어떤 하늘에서도 같은 대비로 읽히게 합니다.
      */}
      <p
        id={hintId}
        className={cn(
          'mx-auto mt-2 w-fit rounded-full px-3.75 py-1',
          'border-stonegray/60 bg-ivory/80 border backdrop-blur-[7px]',
          'text-charcoal-soft text-center text-[11.5px]',
        )}
      >
        {mode === 'nl'
          ? '느낌 · 상황을 말로 적으면 어울리는 향수를 골라 드립니다'
          : '지도에 있는 향수 200개를 이름 · 브랜드로 찾습니다'}
      </p>
    </div>
  )
}

/**
 * 엔진 검색창과 **같은 자리**.
 *
 * 무대 기준 `--pb-search-top` 에 앱 헤더 높이(90 · `coveredTop`)를 더한 값입니다.
 * 엔진의 반응형 단계(`landing/index.html` 의 @media)를 그대로 옮겼습니다 —
 * 폭 1280 · 1024 · 760, 높이 700 · 560.
 *
 *   기본 90+30=120 · 폭 760 이하 90+12=102 · 높이 700 이하 90+22=112 · 높이 560 이하 90+10=100
 *
 * ⚠️ `pointer-events-none` 은 이 껍데기에만 겁니다. 3D 는 이 띠 뒤로도 이어지고
 *   빈자리를 드래그하면 배가 돌아야 합니다 — 알약 자신은 `pointer-events-auto` 로 되돌립니다.
 */
const POSITION = cn(
  'pointer-events-none absolute inset-x-0 top-30 z-10',
  'max-[760px]:top-25.5',
  '[@media(max-height:700px)]:top-28',
  '[@media(max-height:560px)]:top-25',
)

/**
 * 엔진 검색창과 **같은 크기** (`--pb-search-w` · `--pb-search-h`).
 *
 * 기본 450×50 · 1280 이하 420 · 1024 이하 400 · 760 이하 `100vw - 104px` 에 높이 42 ·
 * 화면 높이 560 이하 40.
 */
const SIZE = cn(
  'h-12.5 w-[450px]',
  'max-[1280px]:w-[420px]',
  'max-[1024px]:w-[400px]',
  'max-[760px]:h-10.5 max-[760px]:w-[calc(100vw-104px)]',
  '[@media(max-height:560px)]:h-10',
)

/** 두 방식을 맞바꾼다는 표시. 화살표 둘이 서로 반대로 돕니다 */
function SwapIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-3"
    >
      <path d="M4 8h13m0 0-3.5-3.5M17 8l-3.5 3.5M20 16H7m0 0 3.5-3.5M7 16l3.5 3.5" />
    </svg>
  )
}
