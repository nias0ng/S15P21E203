import { useEffect, useLayoutEffect, useRef, type CSSProperties } from 'react'
import { useNavigate } from 'react-router'

import {
  diveDuration,
  diveFrameAt,
  HOLD_MIN_MS,
  inOutCubic,
  LIFT_MS,
  READY_CAP_MS,
  RISE_CAP_MS,
  RISE_ENGINE_FROM,
} from '@/shared/lib/diveTrack'
import { useDiveStore } from '@/shared/store/diveStore'

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
/** 움직임 줄이기인가 — 세 효과가 같은 판단을 씁니다 */
const reducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * 떠오를 때 커튼이 **떠나는 방에서** 옮겨 받는 물빛 — 방(`styles/scent-display.css` 의
 * `.scent-night`)이 내주고 `dive-curtain.css` 의 떠오르기가 씁니다. 여기는 이름만 압니다.
 */
const ROOM_WATER = ['--room-water', '--room-water-deep'] as const

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
    const reduced = reducedMotion()
    const duration = diveDuration(reduced, depth)
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
      const frame = diveFrameAt(performance.now() - started, duration)
      water.current?.style.setProperty('--dive-cover', frame.cover.toFixed(4))
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
      if (rising && !reducedMotion()) store.engine?.(RISE_ENGINE_FROM)
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
    const rising = way === 'rise' && !reducedMotion()
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
    const timer = window.setTimeout(finish, LIFT_MS + (rising ? 300 : 0))
    return () => {
      cancelAnimationFrame(raf)
      window.clearTimeout(timer)
    }
  }, [stage, way])

  if (stage === 'idle') return null

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
