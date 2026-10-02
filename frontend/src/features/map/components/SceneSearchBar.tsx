import { useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useTourStep } from '@/shared/hooks/useTourStep'
import { cn } from '@/shared/lib/cn'
import { useTourStore } from '@/shared/store/tourStore'
import { SearchField } from '@/shared/ui/SearchField'
import { TourTip } from '@/shared/ui/TourTip'

type Props = {
  /** 적은 말로 추천을 찾습니다. 빈 문자열은 오지 않습니다 */
  onSearch: (keyword: string) => void
  /**
   * **검색 안내(`search`)를 보여도 되는 때인가** — 로딩 커튼이 걷혔고 다른 창 · 잠수 · 해도가 없을 때입니다.
   * 안내는 검색창 아래 설명줄 자리에 서고, 첫 검색이나 [×] 로 끝납니다. 언제 서는지(항해 줄기의 앞 단계 뒤)는
   * `tourStore` 가 정합니다.
   */
  introduce?: boolean
  /** 시작 칸의 '요즘 인기 향수' — 화면이 넘어갈 길을 고릅니다(메인을 떠나는 잠수). 없으면 그 줄을 안 그립니다 */
  onBrowsePopular?: () => void
  className?: string
}

/*
 * 검색창 자리표시 · 이름표 · 설명줄은 `map` 묶음의 `search.placeholder` · `search.tag` · `search.hint` 에 둡니다.
 *
 * - 메인 검색은 **느낌 · 상황을 말로 적어 추천받는 한 가지**입니다. 향수 이름을 이미 아는 사람은 헤더를 거쳐
 *   향수 목록(A33)으로 가고, 이 칸에 이름을 적은 사람은 추천 결과창이 전체 향수 검색(A09)으로 이어 줍니다
 *   (`RecommendModal` 의 `NoConditionState`).
 * - 이름표는 **무엇을 적는 칸인가**를 말합니다('느낌·상황'). 예전 이름 '자연어' 는 만든 사람의 말이라,
 *   처음 온 사람은 그게 무엇인지 몰라 아는 향수 이름을 넣었습니다(지인 피드백 F1).
 * - 자리표시는 물음('어떤 향을 찾고 계신가요?') 대신 **예시**입니다. 시작 문장은 눌러야 펼쳐져서
 *   입력 전에 늘 보이는 글은 이 칸뿐입니다(F1 · F19). 예시는 LLM 없이도 결과가 나오는 말입니다 —
 *   `RecommendModal` 의 `RETRY_EXAMPLES` 참고.
 * NOTE: 이름표의 폭만큼 입력칸이 좁아집니다. 이름표나 예시를 늘리기 전에 1536 · 1280 · 좁은 화면(375)에서 보고 정합니다.
 */

/**
 * 빈 검색창을 누르면 펼쳐지는 **시작 문장** (2026-10-01 · 메인 사용성 테스트). 문장은 `map` 묶음의
 * `search.starters` 에 있고 여기는 차례만 둡니다.
 *
 * 처음 온 사람은 무엇을 적어야 할지 몰랐고("향수 처음 사보는데 뭐가 좋아요?" 처럼 묻다 막혔습니다),
 * 실패 화면이 예로 든 문장은 눌러지지도 않았습니다. 여기 있는 것은 **눌러서 바로 찾는** 문장입니다.
 * ⚠️ 문장은 추천 서버가 다섯 개를 돌려주는 것을 확인한 것만 둡니다(2026-10-01 로컬 · GMS) —
 *   누르자마자 '못 알아들었습니다' 가 나오면 시작 칸이 함정이 됩니다. 문장을 바꾸면 다시 확인합니다.
 *   영어 문장도 같은 날 로컬에서 다섯 개씩 돌아오는 것을 봤습니다.
 */
const STARTER_KEYS = ['rain', 'soap', 'vanilla', 'floral'] as const

/**
 * 3D 향 지도 위의 검색창 (A01 — MAP-01).
 *
 * ⚠️ **엔진이 아니라 앱이 그립니다.** 원래 이 알약은 엔진 페이지
 * (`landing/index.html` 의 `#search-input`) 안에 있었습니다. 답이 앱의 모달(추천
 * 결과창)이라 앱으로 올렸습니다 — 검색창은 결과 화면을 아는 쪽이 쥐고 있어야
 * 하는데, 엔진은 iframe 안이라 라우터도 모달도 모릅니다.
 * 엔진 쪽 알약은 `ScentScene` 이 숨깁니다.
 *
 * 그래서 **자리와 크기를 엔진 값에 맞춰 두었습니다**(아래 POSITION · SIZE).
 * 엔진의 설명문구(`#zone-info`)가 검색창 아래 36px 에 서는데, 그 계산은 엔진
 * CSS 변수(`--pb-search-top` · `--pb-search-h`)로 하고 그 변수는 iframe 문서
 * 안에만 있습니다. 앱이 제 마음대로 크기를 정하면 두 글자가 겹칩니다.
 */
export function SceneSearchBar({
  onSearch,
  introduce = false,
  onBrowsePopular,
  className,
}: Props) {
  const [keyword, setKeyword] = useState('')
  const hintId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const { t } = useTranslation(['map', 'tour'])

  /*
    ⭐ **빈 검색창에 초점이 오면 시작 문장을 펼칩니다** (위 STARTER_KEYS). 초점이 **입력칸이나 시작 문장**에
    있을 때만입니다 — 보내기 단추를 마우스로 누른 것은 아닙니다(단추에 남는 초점으로 줄이 붙박이는
    함정입니다 · 아래 `focus-visible` 머리말). 무엇을 적기 시작하면 접습니다.
  */
  const [starting, setStarting] = useState(false)
  const startersOpen = starting && keyword.trim() === ''

  /*
    첫 방문 안내의 검색 단계가 설명줄 자리에 섭니다 (`tourStore`). 처음 온 사람은 설명줄을 볼 까닭(마우스 올리기)이
    없어 이 칸에 무엇을 적어야 하는지 몰랐습니다(사용성 테스트). 바다 · 방향키 · 부표를 배운 뒤 화면이 비어 있으면 서고,
    첫 검색으로 끝납니다.
    안내가 서 있는 동안은 설명줄을 화면에서만 걷습니다 — 둘이 같은 자리 · 같은 말을 겹쳐 합니다.
  */
  const searchTip = useTourStep('search', introduce)
  const stopTour = useTourStore((state) => state.stop)
  const tip = searchTip.showing

  const search = (text: string) => {
    searchTip.finish()
    onSearch(text)
  }
  const pick = (text: string) => {
    setKeyword(text)
    search(text)
  }

  return (
    // `group` 은 아래 설명줄이 **알약의 호버**를 보기 위한 것입니다 (`group-has-[form:hover]`).
    // ⚠ 껍데기가 `pointer-events-none` 이어도 됩니다 — `:has()` 는 DOM 상태를 볼 뿐이고,
    //   실제로 호버를 받는 것은 `pointer-events-auto` 인 알약(form) 자신입니다
    <div
      className={cn(POSITION, 'group', className)}
      onFocus={(event) => {
        const target = event.target as HTMLElement
        // 시작 칸(시작 문장 · 그 위의 검색 안내) 안에서 옮겨 다니는 초점은 칸을 그대로 둡니다
        setStarting(
          target.tagName === 'INPUT' ||
            target.closest('[data-starter]') !== null,
        )
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setStarting(false)
        }
      }}
    >
      <SearchField
        ref={inputRef}
        label={t('search.fieldLabel')}
        placeholder={t('search.placeholder')}
        value={keyword}
        onChange={(event) => setKeyword(event.target.value)}
        aria-describedby={hintId}
        /*
          ⚠️ 왼쪽 여백을 알약 기본값(20)에서 6 으로 줄입니다 — 왼쪽에 서는 것이 아이콘이
          아니라 **제 바탕이 있는 이름표**라, 20 을 두면 칸이 알약 한가운데로 밀려 오른쪽
          보내기 단추와 어긋나 보입니다. 두 단추가 같은 만큼 안으로 들어와야 짝이 맞습니다.
        */
        className={cn(SIZE, 'pointer-events-auto mx-auto pl-1.5')}
        onSearch={(value) => {
          const trimmed = value.trim()
          if (!trimmed) return
          search(trimmed)
        }}
        leading={<SearchTag onPick={() => inputRef.current?.focus()} />}
        /*
          메인만 모래빛입니다 (`--color-scene-send`). 여기는 판이 아니라 3D 바다 · 하늘
          위라 뒤의 밝기가 시간대마다 바뀌는데, 방을 따르는 `archive` 의 청동 · 남색은
          노을 하늘에서 바탕에 잠깁니다.
        */
        tone="scene"
      />

      {/*
        ⭐ 설명줄은 **알약 뒤에 숨어 있다가 마우스를 올리면 아래로 빠져나옵니다** (2026-09-20 사용자 지시).
          이름표(`SearchTag`)는 무엇을 적는 칸인가를 말하고, 이 줄은 그래서 무엇을 하는가를 말합니다 —
          늘 떠 있을 필요는 없고, 처음 보는 사람이 검색창에 손을 가져갔을 때 있으면 됩니다.

        ⚠️ 숨는 방식이 `display:none` 이 아니라 **덮개(overflow-hidden) 안에서 위로 밀어 둔 것**입니다.
          `aria-describedby` 가 가리키는 줄이라 DOM 에서 빠지면 화면 낭독기가 설명을 잃습니다.
        ⚠️ 덮개는 알약 **바로 아래**에 붙고, 안쪽 겹이 제 높이(윗숨 8 + 줄)만큼 위로 올라가 있습니다.
          그래서 나올 때 알약 밑동에서 밀려 나오는 것처럼 보입니다 — 틈에서 갑자기 생기지 않습니다.
        ⚠️ 아래쪽 숨(`pb-2`)은 **튀어나오는 곡선이 지나갈 자리**입니다. 없으면 덮개가 그 몫을
          잘라내 되돌아오는 움직임만 남습니다.
        ⚠️ 이 줄은 엔진 설명문구(`#zone-info`)와 **2px 차이로 붙어 있습니다** — 평소에 숨어 있게
          되면서 그 물림이 사라졌지만, 열렸을 때의 높이는 여전히 그 2px 안입니다
          (기본 178~204 vs 206 · 760 이하 152~178 vs 180 · 높이 560 이하 148~174 vs 176).
          **글자 크기 · 세로 숨을 키우면 해역에 들어갔을 때 두 글자가 물립니다.**
        ⚠️ **글자만 얹으면 안 읽힙니다.** 뒤가 3D 바다라 시간대마다 밝기가 바뀌고
          (노을 · 낮 · 밤), 흰 글자에 그림자를 줘도 노을 하늘에서는 묻힙니다. 검색창과
          같은 아이보리 종이를 한 장 깔아 어떤 하늘에서도 같은 대비로 읽히게 합니다.
      */}
      <div className="overflow-hidden pb-2">
        <div
          className={cn(
            'pt-2 will-change-transform',
            '-translate-y-full transition-transform duration-[320ms]',
            // 되돌아올 때보다 나올 때가 조금 지나쳤다 앉습니다 — '튀어나온다' 는 그 한 번입니다
            'ease-[cubic-bezier(0.34,1.5,0.64,1)]',
            'group-has-[form:hover]:translate-y-0',
            /*
              ⚠⚠ **`focus-within` 이 아니라 `focus-visible` 입니다** — 단추를 마우스로 누르면
              그 단추에 포커스가 남는데, `focus-within` 으로 열어 두면 **마우스가 떠나도 줄이
              붙박여 있습니다.** 마우스 누름은 `:focus-visible` 이 아니므로(실측) 이걸로 가르면
              — 눌러도 마우스가 있는 동안만 떠 있고, 손이 떠나면 같이 들어갑니다.
              키보드로 Tab 해서 들어온 것은 `:focus-visible` 이라 그대로 열립니다.
            */
            'group-has-[:focus-visible]:translate-y-0',
            'motion-reduce:transition-none',
            // 첫 방문 안내 · 시작 문장이 펼쳐진 동안은 마우스와 상관없이 나와 있습니다
            (tip || startersOpen) && 'translate-y-0',
          )}
        >
          <p
            id={hintId}
            className={cn(
              'mx-auto w-fit rounded-full px-3.75 py-1',
              'border-stonegray/60 bg-ivory/80 border backdrop-blur-[7px]',
              'text-charcoal-soft text-center text-[11.5px]',
              // 화면에서만 걷습니다 — 입력칸의 aria-describedby 가 가리키는 줄입니다
              tip && 'sr-only',
            )}
          >
            {t('search.hint')}
          </p>

          {tip && (
            <TourTip
              data-starter=""
              onClose={searchTip.finish}
              onNext={searchTip.next}
              onStopAll={stopTour}
            >
              {t('tour:search')}
              <span className="text-charcoal-soft block">
                {t('tour:searchExample')}
              </span>
            </TourTip>
          )}

          {/*
            시작 문장 — 설명줄 바로 밑, 같은 종이로 섭니다. 누르면 그 말로 곧바로 찾습니다.
            ⚠️ 누르는 순간 입력칸의 초점이 빠지면 칸이 먼저 접혀 누름이 허공에 떨어집니다 —
              `mousedown` 의 기본 동작(초점 옮기기)을 막습니다. 키보드로 Tab 해 들어온 것은 그대로 받습니다.
            ⚠️ 해역에 들어선 동안이면 엔진 설명문구(`#zone-info`)를 잠깐 덮습니다 — 사람이 검색창에 손을
              댄 동안만이라 그쪽을 먼저 보여 줍니다.
          */}
          {startersOpen && (
            <div
              role="group"
              aria-label={t('search.starters.label')}
              className="pointer-events-auto mx-auto mt-2 flex w-fit max-w-[min(100%,calc(var(--spacing)*150))] flex-wrap justify-center gap-1.5 px-2"
            >
              {STARTER_KEYS.map((key) => {
                const text = t(`search.starters.${key}`)
                return (
                  <button
                    key={key}
                    type="button"
                    data-starter
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => pick(text)}
                    className={STARTER_CHIP}
                  >
                    {text}
                  </button>
                )
              })}
              {onBrowsePopular && (
                <button
                  type="button"
                  data-starter
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={onBrowsePopular}
                  className={cn(STARTER_CHIP, 'text-charcoal font-medium')}
                >
                  {t('search.starters.popular')}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/** 시작 문장 한 칸 — 설명줄과 같은 아이보리 종이라 어느 하늘 위에서도 같은 대비로 읽힙니다 */
const STARTER_CHIP = cn(
  'rounded-full border px-3 py-1.5',
  'border-stonegray/60 bg-ivory/85 backdrop-blur-[7px]',
  'text-charcoal-soft text-[12.5px] hover:bg-ivory hover:text-charcoal',
  'focus-visible:ring-accent-deep outline-none focus-visible:ring-2',
  'transition-colors duration-120 ease-out',
)

/**
 * 엔진 검색창과 **같은 자리**.
 *
 * 무대 기준 `--pb-search-top` 에 앱 헤더 높이(`--header-h` · `coveredTop`)를 더한 값이고,
 * 엔진의 반응형 단계(`landing/index.html` 의 @media)를 그대로 옮겼습니다 —
 * 폭 1280 · 1024 · 760, 높이 700 · 560. 1920 기준으로 적습니다.
 *
 *   기본 90+30=120 · 폭 760 이하 90+12=102 · 높이 700 이하 90+22=112 · 높이 560 이하 90+10=100
 *
 * ⚠️ **한 숫자로 적히는 것은 헤더도 `--spacing` 을 타기 때문입니다** — `--header-h` 가
 *   `--spacing × 22.5` 라 "헤더 + 30" 이 곧 `top-30` 입니다. 좁은 화면에서는 헤더와 그 아래
 *   간격이 **같은 비율로** 줄어듭니다 (1536 에서 72+24=96).
 * ⚠️ 엔진의 `--pb-search-top` 은 고정 px 이라 1536 에서 엔진 알약은 102, 이 알약은 96 으로
 *   6px 갈라집니다. 엔진 알약은 `ScentScene` 이 숨겨 **상자만 남으므로**(카드가 피할
 *   자리) 눈에 보이는 어긋남은 없고, 피할 띠가 이 알약보다 아래·넓어 카드는 그대로 비켜섭니다.
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
 * 엔진 검색창과 **같은 크기** (`--pb-search-w` · `--pb-search-h`) — 1920 기준으로 적습니다.
 *
 * 기본 450×50 · 1280 이하 420 · 1024 이하 400 · 760 이하 `100vw - 104px` 에 높이 42 ·
 * 화면 높이 560 이하 40.
 *
 * ⚠️ **치수는 유틸리티로 적습니다** (`w-112.5` = 450/4). 임의값 px 로 박으면 `--spacing` 을
 *   안 타 이 알약만 안 줄고, 같이 서는 향해 일지 판(`top-30 left-7.5 w-60`)과 어긋납니다.
 *   옆 여백처럼 `calc` 안에 들어가는 자리는 `var(--spacing)` 을 곱해 씁니다.
 * ⚠️ **글자는 안 줄어듭니다** — 알약이 1536 에서 360 으로 줄어도 이름표(12px) · 입력
 *   (13px)은 그대로라 안내 문구가 먼저 잘립니다. 두 폭에서 다 보고 정합니다.
 */
const SIZE = cn(
  'h-12.5 w-112.5',
  'max-[1280px]:w-105',
  'max-[1024px]:w-100',
  'max-[760px]:h-10.5 max-[760px]:w-[calc(100vw-var(--spacing)*26)]',
  '[@media(max-height:560px)]:h-10',
)

/**
 * 입력칸 왼쪽의 **이름표** — 이 칸에 무엇을 적는가('느낌·상황')를 말합니다.
 *
 * 누르면 입력칸에 초점을 줍니다. 첫 방문 안내가 "'느낌·상황'을 눌러 …" 라고 가리키는 자리라
 * 넓은 화면에서도 좁은 화면에서도 늘 보이고 눌러져야 합니다.
 *
 * NOTE: 화면 낭독기와 Tab 차례에서는 뺍니다(`aria-hidden` · `tabIndex -1`). 입력칸의 이름
 *   (`search.fieldLabel`)이 같은 말을 이미 하고, 초점만 옮기는 단추가 Tab 차례에 끼면 같은 칸에
 *   두 번 들르게 됩니다.
 * NOTE: `mousedown` 의 기본 동작(초점 옮기기)을 막습니다 — 이름표가 초점을 받았다가 입력칸으로
 *   넘기면 그 사이에 시작 문장이 접혔다 펼쳐집니다(껍데기의 onFocus · onBlur).
 * NOTE: 높이(32)는 알약(50) 안에서 위아래 9 를 남기는 값입니다 — 같은 중심이라 `rounded-full` 이
 *   알약의 곡선과 한 곡선 위에 놓이고, 오른쪽 보내기 단추(35)와도 짝이 맞습니다.
 */
function SearchTag({ onPick }: { onPick: () => void }) {
  const { t } = useTranslation('map')
  return (
    <button
      type="button"
      tabIndex={-1}
      aria-hidden
      onMouseDown={(event) => event.preventDefault()}
      onClick={onPick}
      className={cn(
        'bg-scene-pill text-ivory text-caption shrink-0 cursor-text rounded-full px-3.5 py-2.5 leading-none font-medium whitespace-nowrap',
        'transition-[filter] duration-120 ease-out hover:brightness-105',
      )}
    >
      {t('search.tag')}
    </button>
  )
}
