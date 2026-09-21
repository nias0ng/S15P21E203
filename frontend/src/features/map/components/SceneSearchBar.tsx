import { useId, useLayoutEffect, useRef, useState } from 'react'

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

/** 칸이 서는 차례입니다 — 화면 순서이자 색이 섞이는 축(왼쪽 0 → 오른쪽 1)입니다 */
const MODES = ['nl', 'normal'] as const

/** 옆 칸. 칸이 둘뿐이라 '다음' 이 곧 '나머지' 입니다 */
function otherMode(item: SceneSearchMode): SceneSearchMode {
  return MODES[(MODES.indexOf(item) + 1) % MODES.length]!
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

/** 지금 방식이 **무엇을 해 주는가**. 알약에 마우스를 올렸을 때만 아래로 나옵니다 */
const MODE_HINT: Record<SceneSearchMode, string> = {
  nl: '느낌 · 상황을 말로 적으면 어울리는 향수를 추천 해드립니다',
  normal: '지도에 있는 향수 200개를 이름 · 브랜드로 찾습니다',
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
  // 방식을 바꿔도 치던 글은 남깁니다 — 같은 말을 두 방식으로 해보는 것이 이 칸의 쓸모입니다
  const [keyword, setKeyword] = useState('')
  const hintId = useId()

  return (
    // `group` 은 아래 설명줄이 **알약의 호버**를 보기 위한 것입니다 (`group-has-[form:hover]`).
    // ⚠ 껍데기가 `pointer-events-none` 이어도 됩니다 — `:has()` 는 DOM 상태를 볼 뿐이고,
    //   실제로 호버를 받는 것은 `pointer-events-auto` 인 알약(form) 자신입니다
    <div className={cn(POSITION, 'group', className)}>
      <SearchField
        label={mode === 'nl' ? '자연어로 향수 추천받기' : '향수 이름으로 찾기'}
        placeholder={PLACEHOLDER[mode]}
        value={keyword}
        onChange={(event) => setKeyword(event.target.value)}
        aria-describedby={hintId}
        /*
          ⚠️ 왼쪽 여백을 알약 기본값(20)에서 6 으로 줄입니다 — 왼쪽에 서는 것이 아이콘이
          아니라 **제 바탕이 있는 칸**이라, 20 을 두면 칸이 알약 한가운데로 밀려 오른쪽
          보내기 단추와 어긋나 보입니다. 두 단추가 같은 만큼 안으로 들어와야 짝이 맞습니다.
        */
        className={cn(SIZE, 'pointer-events-auto mx-auto pl-1.5')}
        onSearch={(value) => {
          const trimmed = value.trim()
          if (!trimmed) return
          onSearch(trimmed, mode)
        }}
        leading={<ModeSwitch mode={mode} onModeChange={onModeChange} />}
      />

      {/*
        ⭐ 설명줄은 **알약 뒤에 숨어 있다가 마우스를 올리면 아래로 빠져나옵니다** (2026-09-20 사용자 지시).
          방식 이름(`ModeSwitch`)은 어느 쪽인가를 말하고, 이 줄은 그래서 무엇을 하는가를 말합니다 —
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
              ⚠⚠ **`focus-within` 이 아니라 `focus-visible` 입니다** (2026-09-20 사용자 :
              *"스왑 버튼 눌렸을때도 … 마우스 이탈하면 사라지게"*). 마우스로 방식을 누르면
              그 단추에 포커스가 남는데, `focus-within` 으로 열어 두면 **마우스가 떠나도 줄이
              붙박여 있습니다.** 마우스 누름은 `:focus-visible` 이 아니므로(실측) 이걸로 가르면
              — 눌러도 마우스가 있는 동안만 떠 있고, 손이 떠나면 같이 들어갑니다.
              키보드로 Tab 해서 들어온 것은 `:focus-visible` 이라 그대로 열립니다.
            */
            'group-has-[:focus-visible]:translate-y-0',
            'motion-reduce:transition-none',
          )}
        >
          <p
            id={hintId}
            className={cn(
              'mx-auto w-fit rounded-full px-3.75 py-1',
              'border-stonegray/60 bg-ivory/80 border backdrop-blur-[7px]',
              'text-charcoal-soft text-center text-[11.5px]',
            )}
          >
            {MODE_HINT[mode]}
          </p>
        </div>
      </div>
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

/**
 * 스프링 값 — 참고한 움직임은 tinkerfx 의 *Elastic Tabs* 입니다 (2026-09-20 사용자 지시).
 *
 * 핵심은 **폭을 애니메이션하지 않는다**는 것입니다. 알약의 두 모서리를 각각 제 스프링으로
 * 쫓게 두고, 폭은 매 장 `오른끝 − 왼끝` 으로 나오는 결과값입니다. 가는 쪽을 보는 모서리가
 * 빠르고(`speed`) 뒤따르는 모서리가 느려서(`speed × lag`) 달리는 동안 둘이 벌어졌다가,
 * 앞이 먼저 닿아 뒤를 기다리는 동안 다시 오므라듭니다 — 늘어나는 껌처럼 보이는 것이 이것입니다.
 *
 * 감쇠(`bounce`)가 낮아 모서리가 목표를 지나쳤다 흔들리며 앉습니다.
 *
 * ⚠⚠ **참고 페이지의 슬라이더 값(14 · 0.45 · 0.72)을 그대로 옮기지 않았습니다** — 스프링을 적는
 * 식이 서로 달라 같은 숫자가 같은 움직임이 아닙니다. 그 값을 그대로 넣었더니 늘어남은 비슷한데
 * (+48%) **지나침이 42% · 안착이 1.17초**로 헐렁했습니다 (2026-09-20 실측).
 * 그래서 숫자가 아니라 **움직임을 맞췄습니다.** 참고 쪽을 재 보면 :
 *
 *   도착 ~140ms · 최대 늘어남 **+62%** · 되돌아옴 7% 남짓 · 다 앉기까지 ~350ms
 *
 * ⭐ **꼬리를 길게 · 천천히** (2026-09-20 사용자 : *"레이아웃의 꼬리를 더 길게 주고 … 더 천천히
 * 움직이며 스며들듯이"*). 참고 쪽보다 일부러 느립니다 — 색이 스며드는 것을 보여 주는 것이
 * 이 움직임의 목적이 됐고, 350ms 에서는 그 번짐이 지나가 버립니다.
 *
 * 지금 값의 실측 (2026-09-20) : 늘어난 폭 **87.1 / 89.1px**(칸 줄 105 의 84%) · 안착 **763 / 756ms** ·
 * 판 밖으로 **0px**. 양방향이 거의 같습니다.
 * ⚠ 늘어남은 **%가 아니라 px 로 봅니다** — 두 칸의 폭이 달라(자연어 53 · 이름 42) 같은 폭도
 *   %로는 +64% 와 +112% 로 갈립니다.
 *
 * ⚠⚠ **`lag` 는 꼬리의 길이이자 안착 시간입니다 — 둘이 한 손잡이입니다.** 뒤 모서리가 과감쇠로
 *   넘어가는 문턱이 `speed × lag / 60 > (1 − √bounce)²` 이고, 지금(`bounce` 0.52)은 **0.083** 입니다.
 *   지금 값은 `26 × 0.1 / 60 = 0.043` 으로 **문턱 아래** — 그래서 꼬리가 길고 느립니다 (의도한 것입니다).
 *   빠르게 되돌리려면 문턱 위로 올립니다 (실측 : `speed 48 · lag 0.15` = 0.12 → 안착 294 / 238ms ·
 *   늘어난 폭 81px). 꼬리만 길게 두고 빠르게 하는 조합은 없습니다.
 */
const SPRING = { speed: 26, lag: 0.1, bounce: 0.52 }
/** 스프링은 **고정 간격**으로 적분합니다 — 창이 60장을 못 내도 움직임이 같아야 합니다 */
const STEP_MS = 1000 / 60
/**
 * 두 모서리가 다 앉았다고 보는 선 (px · px/장).
 *
 * ⚠ 0.05 로 두면 **보이지도 않는 꼬리를 400ms 더 깁니다** — 뒤 모서리가 과감쇠라 마지막
 * 0.35px 를 기는 데 18장이 더 듭니다. 그동안 그라데이션을 매 장 다시 칠하므로, 멈춘 것처럼
 * 보이는 알약이 화소 경계에서 아른거립니다. 0.2px 면 기기 화소(배율 2)의 반보다 작아
 * 멈추는 순간의 보정이 눈에 안 보입니다.
 */
const REST = 0.2
/**
 * 색이 다 바뀌는 데 드는 장 수 (18장 ≈ 300ms — 알약이 앉는 때와 같이 끝납니다).
 *
 * ⚠⚠ **색을 알약의 자리에서 뽑지 않습니다.** 처음엔 알약 한가운데가 두 칸 사이 어디인지로
 * 섞었는데, 늘어나는 동안 **가운데가 앞서 달립니다** — 실측 2026-09-20 : 102ms 에 이미 남색의
 * 90%(`rgb(30,42,64)`)였고 알약은 300ms 까지 움직였습니다. 색이 가장 빠르고 크게 늘어난
 * 구간에 다 끝나 버려, 눈이 움직임을 좇는 동안 변화가 지나가 **안 바뀐 것처럼 보였습니다.**
 * 그래서 색만 **제 시계**로 갑니다 — 가운데가 느린 `inOutCubic` 이라 변화가 중간에 몰립니다.
 */
const TINT_STEPS = 40
/**
 * 스며드는 띠의 폭 (알약 폭 대비). 넓을수록 경계가 없는 **넓은 물듦**이고, 좁으면 색이
 * 한 줄로 쓸고 지나갑니다. 0.55 면 알약의 절반이 늘 섞이는 중이라 선이 안 보입니다.
 */
const TINT_SOFT = 0.55

function ModeSwitch({
  mode,
  onModeChange,
}: Pick<Props, 'mode' | 'onModeChange'>) {
  const trackRef = useRef<HTMLDivElement>(null)
  const pillRef = useRef<HTMLSpanElement>(null)
  const tabRefs = useRef<Partial<Record<SceneSearchMode, HTMLButtonElement>>>(
    {},
  )
  /**
   * 움직이는 알약의 두 모서리와 그 속도. `live` 는 '한 번은 그렸다' 입니다.
   * `tint` 는 색이 어디까지 왔는가(0 자연어 · 1 이름)이고 `tintFrom` · `tintStep` 이 그 제 시계입니다.
   */
  const edge = useRef({
    l: 0,
    r: 0,
    vl: 0,
    vr: 0,
    tint: 0,
    tintFrom: 0,
    tintStep: 0,
    live: false,
  })
  /** 마지막으로 본 칸 줄의 폭. ResizeObserver 가 **정말 달라졌을 때만** 일하게 하는 자물쇠입니다 */
  const trackW = useRef(0)

  /*
   * ⚠️ 값을 React 상태로 올리지 않습니다 — 초당 60번 앱 전체가 다시 그립니다.
   *   rAF 안에서 DOM 에 **직접** 씁니다 (`shared/ui/DiveCurtain` 과 같은 규율입니다).
   * ⚠️ `useLayoutEffect` 입니다 — 첫 장에 알약이 폭 0 으로 한 번 보였다 제자리를 찾으면
   *   깜빡임이 됩니다. 칠하기 전에 자리를 잡아야 합니다.
   */
  useLayoutEffect(() => {
    const track = trackRef.current
    const pill = pillRef.current
    if (!track || !pill) return

    const root = getComputedStyle(document.documentElement)
    const token = (name: string, fallback: string) =>
      rgbOf((root.getPropertyValue(name) || '').trim() || fallback)
    // 칸의 색 — 왼쪽(자연어) 짙은 녹색에서 오른쪽(이름) 심해 남색으로 섞입니다
    const fill = [
      token('--color-pine-deep', '#1a5c2f'),
      token('--color-navy', '#1e2947'),
    ]
    const inkOff = token('--color-charcoal-soft', '#727170')
    const inkOn = token('--color-ivory', '#f9f6ef')

    /*
     * ⚠⚠ **칸의 자리는 여기서 한 번만 잽니다.** 매 장 `offsetLeft` 를 읽으면 그 한 줄이
     *   방금 쓴 `style.width` 를 확정하려고 **레이아웃을 동기로 돌립니다** (write → read → write).
     *   이 화면은 같은 스레드에서 3D 엔진이 도는 자리라, 그 강제 레이아웃이 장을 놓치게 만들고
     *   놓친 만큼 고정 간격 적분이 한 번에 두 칸을 밀어 **덜덜 떨려 보입니다** (2026-09-20 사용자 지적).
     *   칸의 폭은 방식을 눌러도 안 바뀌므로, 잴 일은 효과가 설 때와 창 크기가 바뀔 때뿐입니다.
     */
    let geo = MODES.map((m) => {
      const el = tabRefs.current[m]
      return { m, l: el ? el.offsetLeft : 0, w: el ? el.offsetWidth : 0 }
    })
    const spot = (m: SceneSearchMode) => geo.find((g) => g.m === m)
    const measure = () => {
      geo = MODES.map((m) => {
        const el = tabRefs.current[m]
        return { m, l: el ? el.offsetLeft : 0, w: el ? el.offsetWidth : 0 }
      })
    }

    const goal = () => {
      const g = spot(mode)
      return g && g.w ? { l: g.l, r: g.l + g.w } : null
    }
    /** 색의 목적지 — 왼쪽 칸이 0, 오른쪽 칸이 1 입니다 */
    const goalTint = MODES.indexOf(mode) / (MODES.length - 1)
    /**
     * 알약이 넘어가면 안 되는 **칸 줄의 안쪽 상자**.
     *
     * ⚠⚠ 스프링은 목표를 지나쳤다 돌아오는데, 고를 것이 둘뿐이라 목표가 **늘 양끝**입니다 —
     * 그래서 지나침이 그대로 판 밖으로 나갑니다 (실측 2026-09-20 : 안쪽 끝 101 인데 오른끝이
     * 112.7 까지, 판 바깥으로 7.7px). 사용자 : *"조금 밖으로 튀어나가는데 이건 없애주고"*.
     * 여기서 벽을 세워 막습니다 — 늘어남(두 모서리의 속도차)은 양 칸 사이에서 일어나므로 그대로입니다.
     */
    const wall = () => {
      const first = geo[0]
      const last = geo[geo.length - 1]
      return first && last && last.w
        ? { min: first.l, max: last.l + last.w }
        : null
    }

    /** 이번 이동이 오른쪽으로 가는가. 새 색이 **들어오는 쪽**을 정합니다 */
    const sweepRight = goalTint >= edge.current.tint

    /*
     * ⚠⚠ **두 모서리를 기기 화소에 맞춰 놓고, 폭은 그 둘의 차로 냅니다.**
     *   `transform` 과 `width` 를 따로 반올림하면 **붙어 있어야 할 오른끝이 장마다 반 화소씩
     *   흔들립니다** — 벽에 못 박힌 모서리가 떠는 것이 눈에는 '덜덜' 로 보입니다.
     *   여기서는 오른끝이 먼저 정해지므로 벽에 닿은 뒤로는 값이 한 번도 안 바뀝니다.
     */
    const dpr = window.devicePixelRatio || 1
    const snap = (v: number) => Math.round(v * dpr) / dpr

    /**
     * `rl` · `rr` · `rStep` 은 **그릴 값**이고, 안 넘기면 적분된 지금 값입니다.
     *
     * ⚠⚠ 적분은 1/60 초 고정 칸인데 화면의 장은 그 칸과 **안 맞습니다** (60 · 120Hz · 게다가
     *   이 화면은 같은 스레드에서 3D 엔진이 돌아 장을 자주 놓칩니다). 그대로 그리면 어떤 장은
     *   한 칸, 어떤 장은 두 칸을 민 자리를 그려 **덜덜 떨려 보입니다.** 그래서 마지막 칸과
     *   지금 칸 **사이를 남은 시간만큼 이어서** 그립니다 — 장이 언제 오든 그 순간의 자리가 됩니다.
     */
    const paint = (rl?: number, rr?: number, rStep?: number) => {
      const e = edge.current
      const l = rl ?? e.l
      const r = rr ?? e.r
      const tintStep = rStep ?? e.tintStep
      const { tint, tintFrom } = e
      const l0 = snap(l)
      const r0 = snap(r)
      pill.style.transform = `translate3d(${l0}px,0,0)`
      pill.style.width = `${Math.max(0, r0 - l0)}px`

      /*
       * ⭐⭐ 색은 **판을 갈아끼우지 않고 한쪽에서 스며듭니다** (2026-09-20 사용자 :
       *   *"그라데이션이 퍼져나가듯 더 천천히 움직이며 스며들듯이"*).
       *   새 색이 **가는 쪽 모서리**에서 들어와 꼬리 쪽으로 번집니다 — 알약이 두 칸에 걸쳐
       *   늘어나 있는 동안 앞머리는 이미 새 색이고 꼬리는 아직 옛 색이라, 색이 건너가는 것이
       *   한 장면으로 보입니다. 한 색을 섞기만 하면 알약 전체가 동시에 변해 '갈아끼웠다' 로 읽힙니다.
       * ⚠ 띠는 알약 **제 폭 기준**이라 늘어나면 같이 늘어납니다 — 번짐이 곧 늘어남입니다.
       * ⚠ 다 스민 뒤에는 **한 색으로 굳힙니다.** 그라데이션을 남겨 두면 가만히 있는 알약이
       *   늘 옅게 갈려 보이고, 글자 뒤 대비가 자리마다 달라집니다.
       */
      if (tintStep >= TINT_STEPS) {
        pill.style.backgroundImage = 'none'
        pill.style.backgroundColor = mix(fill[0]!, fill[1]!, unit(tint))
      } else {
        const p = inOutCubic(tintStep / TINT_STEPS)
        const from = mix(fill[0]!, fill[1]!, unit(tintFrom))
        const to = mix(fill[0]!, fill[1]!, goalTint)
        /*
         * 띠의 중심은 알약 밖(−soft/2)에서 반대쪽 밖(1+soft/2)까지 지나갑니다 — 양끝을 넘어야
         * 시작과 끝이 **완전한 한 색**입니다. 안 넘기면 p=0 인데 앞머리가 이미 섞여 있어 툭 튑니다.
         */
        const span = 1 + TINT_SOFT
        const x = sweepRight
          ? 1 + TINT_SOFT / 2 - p * span
          : -TINT_SOFT / 2 + p * span
        const s1 = ((x - TINT_SOFT / 2) * 100).toFixed(1)
        const s2 = ((x + TINT_SOFT / 2) * 100).toFixed(1)
        pill.style.backgroundImage = sweepRight
          ? `linear-gradient(90deg, ${from} ${s1}%, ${to} ${s2}%)`
          : `linear-gradient(90deg, ${to} ${s1}%, ${from} ${s2}%)`
      }

      /*
       * 글자색은 **알약이 그 칸을 덮은 만큼** 상아색으로 갑니다.
       * ⚠ 클래스로 갈아 끼우면 달리는 동안 두 글자가 다 어두운 알약 위에 놓이는 구간이 생겨
       *   한쪽이 읽히지 않습니다 — 늘어나 있는 동안은 **둘 다** 덮여 있기 때문입니다.
       * ⚠ 자리는 **재 둔 값**(geo)에서 읽습니다 — 여기서 offsetLeft 를 읽으면 위에서 쓴
       *   width 를 확정하려고 레이아웃이 동기로 돌아 장을 놓칩니다 (위 geo 머리말).
       */
      for (const g of geo) {
        const el = tabRefs.current[g.m]
        if (!el || !g.w) continue
        const covered = Math.min(r, g.l + g.w) - Math.max(l, g.l)
        el.style.color = mix(inkOff, inkOn, unit(covered / g.w))
      }
    }

    const at = goal()
    if (!at) return

    const settled = {
      ...at,
      vl: 0,
      vr: 0,
      tint: goalTint,
      tintFrom: goalTint,
      tintStep: TINT_STEPS,
      live: true,
    }

    // 첫 장 · 움직임을 줄여 달라는 설정이면 그냥 가져다 놓습니다
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!edge.current.live || still) {
      edge.current = { ...settled }
      paint()
      if (still) return
    }

    // 색의 시계를 **여기 있는 색에서** 다시 겁니다 — 달리는 중에 눌러도 그 색에서 이어집니다
    edge.current.tintFrom = edge.current.tint
    edge.current.tintStep = 0

    let raf = 0
    let last = performance.now()
    let lag = 0
    // 마지막 칸 **직전**의 자리. 장과 칸 사이를 이어 그리는 데 씁니다 (paint 머리말)
    let prevL = edge.current.l
    let prevR = edge.current.r
    let prevStep = edge.current.tintStep
    const tick = (now: number) => {
      // ⚠ 창이 뒤로 갔다 오면 dt 가 몇 초입니다 — 한 번에 몰아 적분하면 알약이 날아갑니다
      lag = Math.min(lag + (now - last), 200)
      last = now

      const to = goal()
      const box = wall()
      if (!to) return
      while (lag >= STEP_MS) {
        lag -= STEP_MS
        const e = edge.current
        prevL = e.l
        prevR = e.r
        prevStep = e.tintStep
        // 가는 쪽을 **보는** 모서리가 앞이다 — 방향은 매 장 다시 본다 (달리는 중에 눌러도 자연스럽게 돌아선다)
        const toRight = (to.l + to.r) / 2 >= (e.l + e.r) / 2
        const kFront = SPRING.speed / 60
        const kBack = (SPRING.speed * SPRING.lag) / 60
        e.vr = e.vr * SPRING.bounce + (to.r - e.r) * (toRight ? kFront : kBack)
        e.vl = e.vl * SPRING.bounce + (to.l - e.l) * (toRight ? kBack : kFront)
        e.r += e.vr
        e.l += e.vl
        // 벽 — 넘어간 모서리는 세우고 **밖으로 미는 속도만** 버립니다 (안으로 오는 힘은 그대로다)
        if (box) {
          if (e.l < box.min) {
            e.l = box.min
            if (e.vl < 0) e.vl = 0
          }
          if (e.r > box.max) {
            e.r = box.max
            if (e.vr > 0) e.vr = 0
          }
        }
        // 색은 제 시계로 — 가운데가 느린 곡선이라 변화가 움직임의 한가운데에 몰립니다
        if (e.tintStep < TINT_STEPS) e.tintStep += 1
        e.tint =
          e.tintFrom +
          (goalTint - e.tintFrom) * inOutCubic(e.tintStep / TINT_STEPS)
      }
      // 남은 시간만큼 마지막 칸과 지금 칸 사이를 이어서 그립니다 — 장이 칸과 안 맞아도 매끈합니다
      const a = lag / STEP_MS
      paint(
        prevL + (edge.current.l - prevL) * a,
        prevR + (edge.current.r - prevR) * a,
        prevStep + (edge.current.tintStep - prevStep) * a,
      )

      const e = edge.current
      const rest =
        Math.abs(to.l - e.l) < REST &&
        Math.abs(to.r - e.r) < REST &&
        Math.abs(e.vl) < REST &&
        Math.abs(e.vr) < REST &&
        e.tintStep >= TINT_STEPS
      if (rest) {
        edge.current = { ...settled }
        paint()
        return
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    /*
     * 반응형 단계가 바뀌면 칸의 폭이 달라집니다 — 달리게 두지 않고 새 자리에 바로 놓습니다.
     *
     * ⚠⚠ **폭이 정말 달라졌을 때만** 합니다. `observe()` 는 다는 순간 콜백을 **한 번 그냥 부릅니다** —
     *   그대로 두면 방식을 누를 때마다 이 효과가 다시 서면서 그 첫 호출이 모서리를 목표에 **붙여 버려**,
     *   rAF 가 첫 장을 돌기도 전에 알약이 도착해 있습니다. 실측 2026-09-20 : 늘어남 없이 폭이
     *   53 → 42 로 한 번에 튀었습니다 (스프링이 안 도는 것으로 오진하기 쉬운 자리입니다).
     */
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0
      if (w === trackW.current) return
      trackW.current = w
      measure() // 칸의 자리를 다시 잽니다 — 여기가 geo 를 갱신하는 유일한 자리입니다
      const to = goal()
      if (!to) return
      edge.current = { ...settled, ...to }
      paint()
    })
    ro.observe(track)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [mode])

  return (
    <div
      ref={trackRef}
      role="group"
      aria-label="검색 방식"
      /*
        ⚠️ 모서리는 **감싼 검색창에서 따옵니다** — 알약은 높이의 반(50 ÷ 2 = 25)이 모서리인
        스타디움이고, 이 칸은 위아래로 9px 안쪽에 있으므로 같은 중심을 쓰면 25 − 9 = 16,
        곧 제 높이(32)의 반입니다. `rounded-full` 이 그 값입니다 — 둘이 한 곡선 위에 놓입니다.
      */
      className="bg-charcoal/8 relative flex shrink-0 items-center gap-0.5 rounded-full p-1"
    >
      {/* 미끄러지는 알약 — 글자 **뒤**에 깔립니다. 자리 · 폭 · 색은 위 rAF 가 씁니다 */}
      <span
        ref={pillRef}
        aria-hidden
        className="pointer-events-none absolute top-1 bottom-1 left-0 rounded-full"
      />

      {MODES.map((item) => (
        <button
          key={item}
          ref={(el) => {
            if (el) tabRefs.current[item] = el
          }}
          type="button"
          /*
            ⭐ **든 칸을 다시 눌러도 넘어갑니다** (2026-09-20 사용자 : *"제자리 클릭해도 스왑되게
            편리성 넣어줘"*). 고를 것이 둘뿐이라 '지금 것을 또 누르는' 일에는 다른 뜻이 없고,
            그러면 칸 줄 **어디를 눌러도** 방식이 바뀌어 겨냥할 필요가 없어집니다.
          */
          onClick={() => onModeChange(item === mode ? otherMode(item) : item)}
          // 누름 상태를 이름으로도 말합니다 — 칠한 것만으로는 화면 낭독기에 안 들립니다
          aria-pressed={item === mode}
          // 든 칸에는 눌렀을 때 무엇이 되는지를 적어 둡니다 — 글자만 보면 '이미 이건데 왜 누르나' 가 됩니다
          title={
            item === mode
              ? `${MODE_LABEL[otherMode(item)]} 검색으로 바꾸기`
              : undefined
          }
          className={cn(
            // `relative` 라야 알약 위에 글자가 놓입니다 (둘 다 자리를 잡은 요소라 DOM 차례대로 쌓입니다)
            'text-caption relative rounded-full px-2.5 py-1.5 leading-none font-medium whitespace-nowrap',
            'text-charcoal-soft', // rAF 가 덮은 만큼 상아색으로 바꿔 씁니다 — 이건 그 전의 자리
            'focus-visible:ring-accent-deep outline-none focus-visible:ring-2',
          )}
        >
          {MODE_LABEL[item]}
        </button>
      ))}
    </div>
  )
}

/** `#RRGGBB` → `[r, g, b]`. 토큰이 비면 넘긴 기본값을 씁니다 */
function rgbOf(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const full =
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h
  const n = Number.parseInt(full, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** 두 색을 `t`(0~1)로 섞습니다 */
function mix(
  a: [number, number, number],
  b: [number, number, number],
  t: number,
) {
  const c = (i: number) => Math.round(a[i]! + (b[i]! - a[i]!) * t)
  return `rgb(${c(0)} ${c(1)} ${c(2)})`
}

/** 0~1 로 자릅니다. 알약이 목표를 지나쳤을 때 색이 범위를 벗어나지 않게 */
function unit(v: number) {
  return v < 0 ? 0 : v > 1 ? 1 : v
}

/**
 * 가운데가 빠른 곡선. 색이 **시작과 끝에서 천천히** 움직여, 바뀌는 구간이 알약이 가장 크게
 * 늘어나 있는 한가운데에 몰립니다 — 그때 두 칸이 모두 덮여 있어 색이 제일 잘 읽힙니다.
 */
function inOutCubic(p: number) {
  const t = unit(p)
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}
