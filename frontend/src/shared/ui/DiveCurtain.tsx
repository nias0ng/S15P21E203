import { useEffect, useLayoutEffect, useRef, type CSSProperties } from 'react'
import { useNavigate } from 'react-router'

import {
  CABIN_COVER_FROM,
  CABIN_LIFT_MS,
  cabinBleedAt,
  cabinDuration,
  COVER_FROM,
  diveDuration,
  diveFrameAt,
  HOLD_MIN_MS,
  inOutCubic,
  LIFT_MS,
  READY_CAP_MS,
  RISE_CAP_MS,
  RISE_ENGINE_FROM,
} from '@/shared/lib/diveTrack'
import { bleedReach, makeBleedGrain, paintBleed } from '@/shared/lib/inkBleed'
import { prefersReducedMotion } from '@/shared/lib/prefersReducedMotion'
import { useDiveStore, type CabinPoint } from '@/shared/store/diveStore'

import './cabin-curtain.css'
import './dive-curtain.css'

/**
 * 잠수 커튼 — 메인(3D 향 지도)과 콘텐츠 화면 사이의 전환 (2026-09-18 · 2026-09-20 다섯 화면으로)
 *
 * 헤더에서 향수 · 브랜드 · 노트 · 후기 · 자유를 누르면 3D 카메라가 수면으로 고개를 숙이며
 * 다가가고, 화면 아래에서 짙은 바다색이 차올라 덮은 뒤 그 화면으로 넘어가 걷힙니다.
 *
 * ```
 *   0 ~ 30%     3D 만 — 카메라가 내려가기 시작하고 엔진 UI · 메인 검색창이 비킨다
 *   30% ~ 100%  커튼이 화면 아래에서 차오른다. 물 · 하늘도 같이 짙어진다
 *   100%        화면이 다 덮였다 → navigate(to) · 커튼은 더 가라앉고 물결이 숨을 쉰다
 *   준비 신호까지 (최소 0.42초 · 상한 2.60초) 바닥 색 유지
 *   +1.40초     아래에서부터 위로 트인다
 * ```
 *
 * ⭐ **내려가는 데 걸리는 시간은 화면마다 다릅니다** (1.08~1.50초 — `diveTrack` 의 `DIVE_DEPTH`).
 *   위 표를 초가 아니라 **비율**로 적은 까닭입니다 — 구간의 모양은 다섯이 같고 길이만 다릅니다.
 *
 * ⭐ **진열대는 내려가지 않고 배 안으로 들어갑니다** (2026-09-24 — `way` cabin). 같은 단계 ·
 *   같은 준비 신호를 쓰고, 카메라가 배를 향해 줌인하는 동안 그 배에서 **메인에 들어올 때의
 *   구름**이 스며 번져 덮습니다(`shared/lib/inkBleed`). 덮인 채 구름 결이 숨 쉬다가 메인에 들어올
 *   때처럼 가운데서 열리며 천천히 줌인하듯 걷힙니다 (`cabin-curtain.css`).
 *
 * ⚠⚠ **껍데기(`RootLayout`)에 섭니다 — 화면 안에 두면 안 됩니다.** 메인이 언마운트되는 순간
 * 같이 사라져 아이보리 바탕이 그대로 드러납니다 (엔진 안의 `travel.js` 흰 안개가 이식되지
 * 못하는 것과 같은 까닭입니다).
 *
 * ⚠⚠ **시계를 이 컴포넌트가 쥡니다.** 진행도 `k` 를 매 장 3D 엔진(`PB.dive`)에 넘기고 커튼의
 * 차오름도 같은 시계에서 냅니다. 두 판이 각자 재면 카메라와 물이 어긋납니다
 * (`landing/docs/고도화-0917/03-로딩-전환-수중.md` §4-2).
 *
 * ⚠⚠ **진행도는 React 상태로 올리지 않습니다.** 초당 60번이라 앱 전체가 그만큼 다시 그리고,
 * 그 다시 그리기는 3D 엔진과 **같은 스레드**에서 일어납니다. rAF 안에서 CSS 변수와 엔진에
 * 직접 씁니다 (로딩 커튼 `SceneBootCurtain` 과 같은 규율).
 *
 * ⚠ 기다리는 때를 `setTimeout` 이 아니라 rAF 로 봅니다 — 메인 스레드가 막힌 동안 타이머는
 * 늦게 오고, 그만큼 남색 화면이 더 오래 섭니다.
 */
/**
 * 떠오를 때 커튼이 **떠나는 방에서** 옮겨 받는 물빛 — 방(`styles/scent-display.css` 의
 * `.scent-night`)이 내주고 `dive-curtain.css` 의 떠오르기가 씁니다. 여기는 이름만 압니다.
 */
const ROOM_WATER = ['--room-water', '--room-water-deep'] as const

/** 번짐 격자의 가로 칸 수 — 화면 폭과 무관합니다. 세로는 화면 비율을 따릅니다 (`inkBleed` 머리말) */
const BLEED_COLS = 240

/**
 * 배에서 구름을 **스미듯** 번지게 그리는 붓 하나 (`shared/lib/inkBleed`).
 * 전환 한 번에 한 번 만들고, 매 장 번진 정도와 배의 화면 자리를 받아 칠합니다.
 *
 * 색은 커튼 CSS 가 정합니다 — 커튼의 `color`(= `--cabin-veil`)를 거는 순간 읽어 칸에 채웁니다.
 * 떠오르기가 방의 물빛을 읽어 박는 것과 같은 규율이라, 색을 고치려고 여기를 열 일이 없습니다.
 * ⚠ 결을 만드는 데 몇 ms 걸립니다 — 그래서 **누르는 장**에 한 번 만들고, 번지기 시작하는 장에는
 *   그 자리로 젖는 때(`bleedReach`)만 냅니다. 그 뒤로 매 장은 비교 몇만 번입니다.
 *
 * @param canvas 번짐을 그릴 캔버스 — 성긴 격자로 칠하고 CSS 가 화면 크기로 늘립니다
 * @param color 구름의 색 (CSS 색 문자열)
 * @returns 붓 — 캔버스를 못 쓰면(2D 문맥 없음) null. 그때 커튼은 한 장으로 덮입니다
 */
function bleedPainter(canvas: HTMLCanvasElement, color: string) {
  const w = window.innerWidth
  const h = window.innerHeight
  const aspect = w / Math.max(1, h)
  const cols = BLEED_COLS
  const rows = Math.max(1, Math.round(cols / aspect))
  canvas.width = cols
  canvas.height = rows
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null

  // 색 문자열을 캔버스가 읽게 한 점 칠해 되읽습니다 — oklch() · color-mix() 도 캔버스가 sRGB 로 풀어 줍니다
  ctx.fillStyle = color
  ctx.fillRect(0, 0, 1, 1)
  const [r = 0, g = 0, b = 0] = ctx.getImageData(0, 0, 1, 1).data
  ctx.clearRect(0, 0, 1, 1)

  const grain = makeBleedGrain(cols, rows, Math.floor(Math.random() * 1e6))
  const image = ctx.createImageData(cols, rows)
  for (let at = 0; at < image.data.length; at += 4) {
    image.data[at] = r
    image.data[at + 1] = g
    image.data[at + 2] = b
  }
  let reach: Float32Array | null = null

  return (bleed: number, origin: CabinPoint | null) => {
    if (bleed <= 0) return
    reach ??= bleedReach(
      grain,
      cols,
      rows,
      origin ? { x: origin.x / w, y: origin.y / h } : { x: 0.5, y: 0.5 },
      aspect,
    )
    paintBleed(reach, image.data, bleed)
    ctx.putImageData(image, 0, 0)
  }
}

export function DiveCurtain() {
  const navigate = useNavigate()
  const stage = useDiveStore((state) => state.stage)
  /*
    가라앉는가 떠오르는가. 단계는 둘이 같고 다른 것은 **방향과 색**뿐이라, 커튼 CSS 가
    `[data-way='rise']` 에서 판을 통째로 뒤집습니다 (dive-curtain.css).
    ⚠ 여기(TS)가 다루는 차이는 둘뿐입니다 — 엔진을 어느 쪽으로 미는가, 무엇을 기다리는가.
  */
  const way = useDiveStore((state) => state.way)
  /*
    이번 전환이 얼마나 깊은가 0~1 (`diveTrack` 의 `DIVE_DEPTH`). 하는 일은 둘입니다 —
    **내려가는 시간**을 늘리고(아래 `diveDuration`), 커튼의 **끝 색**을 짙게 합니다
    (`dive-curtain.css` 의 `--dive-depth` → `--dive-floor`).
    ⚠ 색 계산은 CSS 가 합니다. 여기서 색을 섞어 넘기면 팔레트가 TS 로 새어 나오고,
      화면을 보며 색을 고치려면 TS 를 고쳐야 하게 됩니다.
  */
  const depth = useDiveStore((state) => state.depth)
  const curtain = useRef<HTMLDivElement>(null)
  const water = useRef<HTMLElement>(null)
  /** 배에서 구름이 스며드는 캔버스 (`bleedPainter`) */
  const bleedCanvas = useRef<HTMLCanvasElement>(null)

  // ── 떠오르기 : 떠나는 방의 물빛을 커튼에 적어 둔다
  useLayoutEffect(() => {
    if (stage !== 'diving' || way !== 'rise') return
    const el = curtain.current
    if (!el) return
    /*
      커튼은 껍데기(`RootLayout`) 안이라 방에 서 있는 동안은 방의 물빛을 **물려받습니다.**
      그런데 다 덮으면 메인으로 옮겨 가고, 그 순간 방(`.scent-night`)이 내려가 물려받던 값도
      같이 사라집니다 — 덮인 채 엔진을 기다리는 동안 커튼이 바다색으로 한 번 튑니다.
      그래서 **떠나기 전에 지금 값을 커튼에 직접 적어 둡니다.** 다 걷히면 커튼이 요소째
      내려가므로 치울 것이 없습니다.
      ⚠ 색을 여기서 고르거나 섞지 않습니다 — 방이 적은 값을 옮길 뿐입니다 (위 `depth` 주석과
        같은 까닭). 방이 안 내주면 빈 값이라 아무것도 안 적고, CSS 가 바다색으로 물러섭니다.
    */
    const inherited = getComputedStyle(el)
    for (const name of ROOM_WATER) {
      const value = inherited.getPropertyValue(name).trim()
      if (value) el.style.setProperty(name, value)
    }
  }, [stage, way])

  // ── 잠수 : 카메라를 내리고 커튼을 올린다. 다 덮으면 간 화면으로 옮겨 간다
  useEffect(() => {
    if (stage !== 'diving') return

    // 움직임 줄이기면 3D 는 그대로 두고 커튼만 짧게 덮습니다 (dive-curtain.css 의 미디어 쿼리와 한 벌)
    const reduced = prefersReducedMotion()
    /*
      선실로 들어가기(진열대)는 같은 시계에 **다른 길이 · 다른 문**입니다 — 엔진은 수면이 아니라
      배를 향해 카메라를 밀고, 커튼은 차오르는 대신 그 배에서 번집니다 (`diveTrack` 의 '선실').
      ⚠ 깊이는 안 봅니다 — 선실은 바다의 깊이 축 위에 있지 않습니다.
    */
    const cabin = way === 'cabin'
    const duration = cabin
      ? cabinDuration(reduced)
      : diveDuration(reduced, depth)
    const coverFrom = cabin ? CABIN_COVER_FROM : COVER_FROM
    /*
      선실 : 구름을 그릴 붓을 **누르는 이 장에** 만듭니다 — 결을 만드는 몇 ms 가 번지는 도중에 끼면
      그 장이 한 번 멈칫합니다. 움직임 줄이기거나 캔버스를 못 쓰면 붓 없이 **한 장이 덮습니다**
      (`data-flat` · cabin-curtain.css).
    */
    let paint: ReturnType<typeof bleedPainter> = null
    if (cabin) {
      const el = curtain.current
      const canvas = bleedCanvas.current
      if (!reduced && el && canvas) {
        paint = bleedPainter(canvas, getComputedStyle(el).color)
      }
      if (el && !paint) el.dataset.flat = ''
    }
    const started = performance.now()
    let raf = 0
    let done = false

    // 덮은 **뒤에** 옮겨 갑니다 — 먼저 옮기면 3D 가 사라진 자리가 한 장 비칩니다
    const finish = () => {
      if (done) return
      done = true
      const { to, markCovered } = useDiveStore.getState()
      markCovered()
      if (to) void navigate(to)
    }

    const tick = () => {
      const frame = diveFrameAt(
        performance.now() - started,
        duration,
        coverFrom,
      )
      if (cabin) {
        /*
          엔진이 카메라를 배 쪽으로 한 장 밀고 **배 가운데의 화면 자리**를 돌려줍니다 — 구름이 거기서 번집니다.
          ⚠ 같은 rAF 안에서 밀고 읽으므로 자리는 엔진의 **한 장 전** 그림의 것입니다. 카메라가 고개를
            안 돌리고 그 점을 향해 곧게 다가가서, 배는 화면에서 제자리에 머뭅니다.
          ⚠ `--cabin-cover` 는 붓이 없는 때(한 장으로 덮을 때)의 짙기입니다 — 붓이 있으면 CSS 가 안 씁니다.
        */
        const origin = reduced
          ? null
          : (useDiveStore.getState().cabinEngine?.(frame.k) ?? null)
        const bleed = cabinBleedAt(frame.k)
        curtain.current?.style.setProperty('--cabin-cover', bleed.toFixed(4))
        paint?.(bleed, origin)
      } else {
        water.current?.style.setProperty('--dive-cover', frame.cover.toFixed(4))
      }
      /*
        엔진이 아직 안 떴으면(로딩 커튼 중) 그냥 커튼만 올라옵니다.
        ⚠ 떠오를 때는 엔진을 **안 건드립니다.** 지금 서 있는 곳은 콘텐츠 화면이라 엔진이 없고,
          있다 해도 그것은 우리가 향해 가는 화면의 것입니다 — 미는 때는 걷힐 때입니다.
      */
      if (!reduced && way === 'dive') useDiveStore.getState().engine?.(frame.k)
      if (frame.covered) {
        finish()
        return
      }
      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    /*
      ⚠⚠ **rAF 가 아예 안 도는 경우의 안전장치입니다.** 잠수 도중에 탭을 바꾸거나 창이 가려지면
      브라우저가 rAF 를 멈춥니다 — 그러면 커튼이 올라오다 만 채로 **화면 이동이 영영 안 일어납니다.**
      (2026-09-18 실측 : 창이 다른 창 뒤에 있는 동안 `--dive-cover` 가 한 번도 안 쓰였습니다.)
      걷는 쪽과 달리 여기는 못 넘어가면 갇히므로, 시계로 한 번 더 받칩니다.
      여유 2초는 rAF 가 늦게 오는 정상 상황(엔진이 메인 스레드를 잡은 동안)을 안 건드리는 값입니다.
    */
    const bail = window.setTimeout(finish, duration + 2000)
    return () => {
      cancelAnimationFrame(raf)
      window.clearTimeout(bail)
    }
  }, [stage, way, depth, navigate])

  // ── 덮인 채로 간 화면을 기다린다 (준비 신호 · 상한 중 먼저 오는 쪽)
  useEffect(() => {
    if (stage !== 'covered') return

    /*
      덮인 채로 **최소 `HOLD_MIN_MS` 는 머뭅니다** — 목록이 캐시에 있으면 준비 신호가 덮자마자 와서,
      느리게 걷는 커튼이 시작하자마자 걷히기 시작합니다 (잠수해서 내려앉은 것이 한 박자도 안 쉽니다).
      ⚠ 콘텐츠 목록 다섯은 진열대보다 가벼워서 **거의 언제나 이 최소 잔류가 실제 대기**입니다.
    */
    const started = performance.now()
    /*
      기다리는 것이 다릅니다 — 가라앉을 때는 **간 화면의 목록**이고,
      떠오를 때는 **3D 엔진**입니다. 엔진 쪽이 더 오래 걸려 상한도 따로 둡니다.
    */
    const rising = way === 'rise'
    const cap = rising ? RISE_CAP_MS : READY_CAP_MS
    const until = started + cap
    let raf = 0
    const lift = () => useDiveStore.getState().lift()
    const tick = () => {
      const now = performance.now()
      const store = useDiveStore.getState()
      /*
        떠오를 때는 엔진이 **기다리는 사이에 뜹니다.** 뜨자마자 잠긴 깊이에 세워 둬야,
        걷히기 시작하는 첫 장에 이미 짙은 바다가 있습니다 — 안 그러면 다 밝은 바다가
        한 장 비쳤다가 다시 어두워집니다. 매 장 넣는 것은 유니폼 한 번이라 쌉니다.
      */
      if (rising && !prefersReducedMotion()) store.engine?.(RISE_ENGINE_FROM)
      const ready = store.ready && now >= started + HOLD_MIN_MS
      if (ready || now >= until) {
        lift()
        return
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    // 위와 같은 안전장치 — 덮인 채로 갇히면 짙은 남색 화면이 영영 남습니다
    const bail = window.setTimeout(lift, cap + 2000)
    return () => {
      cancelAnimationFrame(raf)
      window.clearTimeout(bail)
    }
  }, [stage, way])

  // ── 걷히는 중 · 다 걷혔다
  useEffect(() => {
    if (stage !== 'lifting') return

    let done = false
    const finish = () => {
      if (done) return
      done = true
      const store = useDiveStore.getState()
      // 메인에 그대로 남은 채로 끝난 경우(전환을 접었을 때)를 대비해 엔진도 되돌립니다
      store.engine?.(0)
      store.cabinEngine?.(0)
      store.end()
    }

    /*
      ⭐⭐ **떠오를 때는 3D 가 커튼과 같이 밝아집니다.** 걷히는 동안 엔진을
      `RISE_ENGINE_FROM` 에서 0 으로 되밀어, 카메라가 올라오고 물 · 하늘이 제 색을 되찾습니다.
      커튼이 트인 자리에 **이미 떠오르는 중인 바다**가 있어야 두 판이 한 움직임으로 읽힙니다 —
      다 걷힌 다음에 바다가 밝아지면 전환이 끝나고 나서 한 번 더 무슨 일이 일어난 꼴입니다.

      ⚠ 가라앉을 때는 이 루프를 안 돕니다. 그쪽은 걷히는 동안 엔진이 아예 없습니다
        (메인이 언마운트됐습니다) — 커튼 뒤에 있는 것은 간 화면입니다.
      ⚠ 쓸기와 같은 길이 · 같은 결의 곡선을 씁니다. 갈라지면 바다가 먼저 다 밝아졌는데
        커튼이 아직 남아 있거나 그 반대가 됩니다.
    */
    const rising = way === 'rise' && !prefersReducedMotion()
    const started = performance.now()
    let raf = 0
    const tick = () => {
      const t = Math.min(1, (performance.now() - started) / LIFT_MS)
      useDiveStore.getState().engine?.(RISE_ENGINE_FROM * (1 - inOutCubic(t)))
      if (t >= 1) {
        finish()
        return
      }
      raf = requestAnimationFrame(tick)
    }
    if (rising) raf = requestAnimationFrame(tick)

    // rAF 가 안 도는 동안(창이 가려짐)에도 끝나야 합니다 — 안 그러면 커튼이 영영 남습니다
    // ⚠ 선실은 걷히는 길이가 다릅니다 (`cabin-curtain.css` 의 `--cabin-lift` 와 한 벌)
    const liftMs = way === 'cabin' ? CABIN_LIFT_MS : LIFT_MS
    const timer = window.setTimeout(finish, liftMs + (rising ? 300 : 0))
    return () => {
      cancelAnimationFrame(raf)
      window.clearTimeout(timer)
    }
  }, [stage, way])

  if (stage === 'idle') return null

  /*
    선실로 들어가기 — 잠수의 판을 뒤집어 쓰지 않고 **판을 따로 둡니다** (`cabin-curtain.css`).
    모양이 다르고(차오르는 물 ↔ 문 한 점에서 스며 나가는 구름), 같은 판을 비틀면 둘이 서로를 흉내 냅니다.
    구름은 위 잠수 효과가 rAF 안에서 캔버스에 칠합니다 (`bleedPainter`).
    ⚠ `key` 를 따로 둡니다 — 같은 `div` 라 React 가 잠수의 판을 고쳐 쓰면 남의 인라인 변수가 딸려 옵니다.
  */
  if (way === 'cabin') {
    return (
      <div
        key="cabin"
        ref={curtain}
        aria-hidden="true"
        data-stage={stage}
        className="cabin-curtain fixed inset-0 z-100"
      >
        {/* 구름 한 겹 — 걷힐 때 메인에 들어올 때처럼 가운데서 열리며 통째로 커집니다 */}
        <i className="cabin-curtain-cloud">
          {/* 구름 — 배에서 스며 번집니다 (`bleedPainter`) */}
          <canvas ref={bleedCanvas} className="cabin-curtain-veil" />
          {/* 구름 결 — 덮인 채 기다리는 동안 메인 로딩 커튼처럼 숨 쉽니다 */}
          <i className="cabin-curtain-drift" />
        </i>
      </div>
    )
  }

  return (
    <div
      ref={curtain}
      aria-hidden="true"
      data-stage={stage}
      // 방향 — CSS 가 이 한 글자로 판을 뒤집습니다 (dive-curtain.css 의 '떠오르기')
      data-way={way}
      /*
        깊이 — 바닥 색이 여기서 나옵니다 (dive-curtain.css 의 `--dive-floor`).
        ⚠ rAF 로 매 장 쓰는 `--dive-cover` 와 달리 **전환 한 번에 한 번**이라, 저쪽처럼 ref 로
          직접 쓰지 않고 그냥 인라인 style 로 둡니다 — 이 값은 다시 그릴 일이 없습니다.
        ⚠ `color-mix` 의 비율 자리라 **단위가 붙은 퍼센트**여야 합니다 (`0.35` 가 아니라 `35%`).
      */
      style={
        { '--dive-depth': `${(depth * 100).toFixed(1)}%` } as CSSProperties
      }
      /*
        ⚠ `overflow-hidden` 을 두지 않습니다 — 걷힐 때 이 겹이 화면 밖(위)으로 200vh 나가면서
        그 안의 물판까지 잘려 나갑니다 (dive-curtain.css 의 걷힘 주석). 물판은 위로만 넘치므로
        가로 · 세로 스크롤이 생기지 않습니다.
      */
      className="dive-curtain fixed inset-0 z-100"
    >
      {/*
        걷힘은 겹 둘이 서로를 상쇄하며 지나갑니다 — 쓸기 겹이 마스크를 쥐고 400vh 올라가고,
        상쇄 겹이 같은 양만큼 내려와 안의 것을 제자리에 둡니다 (dive-curtain.css 의 `-sweep` 주석).
        ⚠ 쓸기 겹의 높이가 곧 마스크의 길이입니다 — `mask-clip` 이 그 상자 밖을 통째로 잘라냅니다.
      */}
      <i className="dive-curtain-sweep">
        <i className="dive-curtain-hold">
          <i ref={water} className="dive-curtain-water block" />
          {/* 간 화면을 기다리는 동안 숨 쉬는 물결 — 덮인 뒤에 들어옵니다 */}
          <i className="dive-curtain-drift" />
        </i>
      </i>
    </div>
  )
}
