import { useEffect, useMemo, useRef, type RefObject } from 'react'

import { DECK_MS } from '../components/ShelfDeck'
import {
  LIFT_ENVELOPE,
  liftStep,
  liftTarget,
  swingStep,
  type GustDirection,
  type Swing,
} from '../lib'

/** 한 번 오가는 주기(초). 짧으면 파르르 떨리고, 길면 둔하게 출렁입니다 */
const PERIOD = 0.95

/**
 * 감쇠비. 한 번 오갈 때마다 흔들림이 14% 로 줄어듭니다 — 반대쪽으로 한 번(37%) 넘어갔다 돌아오며
 * 가라앉아, 종이 태그가 공기를 받아 금방 멎는 느낌입니다.
 *
 * 예전 0.16(한 번 오가면 36%) · 0.2(28%)는 벽이 서고도 잔떨림이 오래 남아, 칩으로 옮기면 3.5 ~ 3.9초
 * 뒤에야 흔들기가 끝났습니다.
 */
const DAMPING = 0.3

/**
 * 트랙 가속도(px/s²)를 태그의 각가속도로 바꾸는 비율.
 *
 * 실제 매단 길이(1920 에서 줄 35 + 태그 85 = 120px)로 계산하면 트랙이 워낙 빨라서 태그가
 * 뒤집힐 만큼 휘둘립니다. 기울기로 맞춘 값이라 태그가 커져도 같은 각도로 흔들리고, 매단 길이가
 * 긴 만큼 태그 아랫단은 더 크게 움직입니다. 창이 좁아 트랙이 덜 움직이면 흔들림도 작아집니다.
 *
 * 1920 x 1080 에서 휠 한 번(한 칸)에 2도 남짓, 화살표(세 칸)에 4도 남짓 흔들리고, 칩으로 여섯 칸 넘게
 * 옮기면 한도(6도)에 잠깐 닿습니다. 휠 · 칩 이동이 용수철 · 사인 곡선이 되면서(useShelfFlow) 여러 칸을
 * 옮길 때 트랙이 세게 가속해서, 1/2400 은 휠을 다섯 번 연달아 굴리면 15도 · 벽 끝까지(스물여섯 칸)
 * 옮기면 24도로 밀려 늘 한도에 붙어 있었고, 1/4000 은 흔들림이 너무 얌전했습니다.
 */
const GAIN = 1 / 3000

/**
 * 아무리 세게 밀어도 이 기울기(6도)를 넘지 않습니다. 휠 한두 번 · 화살표에서는 닿지 않고, 휠을 연달아
 * 굴리거나 칩으로 여러 칸을 옮길 때만 잠깐 닿는 안전 한도입니다. 닿으면 바깥으로
 * 가던 속도를 버려서(swingStep) 한도에 붙어 버티다 뒤늦게 튕기지 않습니다.
 *
 * 이웃한 두 태그가 서로 반대로 한도까지 기울어도 아랫모서리가 닿지 않는 값입니다 — 1920 에서
 * 모서리가 한쪽으로 12px 남짓 나오고 한쪽 여유는 23.8px, 390 에서 10px 남짓에 여유 13.3px 입니다
 * (lib.test.ts 의 swingStep).
 */
const LIMIT = (6 * Math.PI) / 180

/** 이보다 작게 흔들리면 멈춘 것으로 봅니다(0.08도 — 태그 아랫단이 0.1px 도 안 움직임) */
const REST = (0.08 * Math.PI) / 180

/** 트랙이 선 뒤 이만큼(프레임) 조용해야 흔들기를 끝냅니다 */
const CALM_FRAMES = 10

/** 진자를 굴리는 한 걸음(초). 프레임이 이보다 길면 여러 걸음으로 나눠 굴립니다 */
const STEP = 1 / 120

/**
 * 프레임 사이가 이보다 길면(초) 그 사이 움직임은 흔들림으로 치지 않습니다.
 * 탭을 떠났다 돌아온 경우라, 그동안 옮겨 간 거리를 한 번에 가속도로 받으면 태그가
 * 한도까지 튕깁니다.
 */
const GAP = 0.25

/** 창 가장자리 바깥 이만큼(px)까지는 기울기를 씁니다 — 창 양 끝 페이드 구간(최대 60)입니다 */
const MARGIN = 60

/**
 * 기울기가 마지막으로 쓴 값에서 이만큼(도) 넘게 바뀔 때만 다시 씁니다. 1920 x 1080 에서 매단 길이
 * (줄 35 + 태그 130 = 165px)의 아랫단이 0.15px 도 안 움직이는 각도라, 그보다 작은 변화는 눈에 안
 * 보이는데 태그를 다시 그리게만 합니다. 바람에 들린 기울기(--tag-lift)도 같은 값으로 거릅니다.
 */
const WRITE_STEP = 0.05

/*
 * ── 바람(무대가 바뀔 때) ─────────────────────────────────
 * 태그가 앞(보는 사람 쪽)으로 들리는 감쇠 진자입니다(lib.ts 의 liftStep). 옆 흔들림보다 빠르고
 * 공기를 넓은 면으로 받아 빨리 가라앉습니다. 바람이 그치면 떨어지며 벽을 한 번 톡 치고 멈춥니다.
 */

/** 도 → 라디안 */
const DEG = Math.PI / 180

/** 앞뒤로 한 번 오가는 주기(초). 옆 흔들림(0.95)보다 빠릅니다 */
const LIFT_PERIOD = 0.62

/** 앞뒤 감쇠비. 바람이 그치고 1초 남짓이면 가라앉습니다 */
const LIFT_DAMPING = 0.34

/**
 * 바람이 태그를 들어 올리려는 기울기. 떠날 때는 무대 밖으로 빠지는 동안이라 세게, 돌아올 때는
 * 화면 안에서 가라앉는 것까지 보여서 조금 약하게 둡니다. 태그마다 0.85 ~ 1.15 배로 흩어집니다.
 */
const LIFT_WIND: Record<GustDirection, number> = {
  leave: 17 * DEG,
  arrive: 12 * DEG,
}

/** 보이는 들림의 한도(26도). 끝에서 뚝 멈추지 않게 tanh 로 눌러 이 값에 다가가기만 합니다 */
const LIFT_CAP = 26 * DEG

/** 줄은 벽 앞에 매달려 있어 이보다 뒤로(−1.5도) 넘어가지 않고, 닿으면 속도를 이만큼(0.35) 남겨 되튑니다 */
const LIFT = {
  omega: (2 * Math.PI) / LIFT_PERIOD,
  damping: LIFT_DAMPING,
  floor: -1.5 * DEG,
  bounce: 0.35,
}

/** 창 가운데에서 먼 태그일수록 바람이 늦게 닿습니다 — 창 끝 태그가 이만큼(초) 늦습니다 */
const LIFT_LAG = 0.045

/**
 * 들린 만큼 창 가운데에서 바깥쪽으로 벌어지는 옆 기울기의 비율. 아래에서 올라온 바람이 가운데에서
 * 양옆으로 흩어지는 모습입니다. 창 끝 태그가 가장 세게 들려도 2도 안쪽입니다.
 */
const LIFT_FAN = 0.08

/**
 * 들림이 이보다 작으면(0.2도, 속도는 그 10 배) 가라앉은 것으로 봅니다. 옆 흔들림(REST)보다 크게 둡니다 —
 * 앞뒤로 기우는 것이라 1920 에서 0.2도면 아랫단 폭이 0.1px 도 안 바뀝니다. REST 로 기다리면 벽을 친 뒤의
 * 보이지 않는 떨림까지 기다려, 패널 뒤 흐림이 0.2초 넘게 늦게 돌아옵니다.
 */
const LIFT_REST = 0.2 * DEG

/** 들림이 이 기울기(20도)면 태그에 드는 빛(--tag-lit)이 가장 밝습니다 */
const LIFT_LIT = Math.sin(20 * DEG)

/**
 * 떠나는 바람을 지우는 시각(초). 무대가 다 빠지고(DECK_MS) 60ms 뒤 들림을 곧바로 0 으로 지웁니다 —
 * 그때는 태그가 화면 밖이라 가라앉는 모습을 보여 줄 필요가 없습니다.
 */
const LEAVE_END = DECK_MS / 1000 + 0.06

/** 지금 부는 바람 — 일으킨 시각(performance.now 기준 ms)과 방향 */
type Gust = { t0: number; direction: GustDirection }

/** 트랙에 useShelfFlow 가 적어 둔 가로 이동(px) */
const shiftOf = (element: HTMLElement) =>
  Number(/translate3d\((-?[\d.]+)px/.exec(element.style.transform)?.[1] ?? 0)

/**
 * 줄에 매달린 이름표를 흔듭니다. 돌려주는 두 함수를 부르세요.
 *
 *   kick   트랙이 움직이기 시작할 때 — 옆으로 흔들림
 *   gust   진열대 ↔ 내 컬렉션 무대를 바꾸기 직전 — 아래에서 바람이 불어 앞으로 들림
 *
 * 트랙의 실제 위치를 매 프레임 읽어 가속도를 구하고, 태그마다 감쇠 진자
 * (`swingStep`)를 한 프레임씩 굴려 그 기울기를 `--tag-swing` 으로 넣습니다.
 * CSS 의 `.shelf-tag-hanger`(줄 + 태그)가 줄이 선반 고리에 걸린 점을 축으로 그만큼 돌립니다.
 * 고리(`.shelf-tag-hook`)는 묶음 밖이라 돌지 않습니다.
 * 트랙을 무엇이 움직였는지는 따지지 않습니다 — 휠이든 칩이든 하단 페이저든 위치만
 * 읽어서 쓰므로 같은 식으로 흔들립니다.
 *
 * 태그마다 주기를 ±10% 다르게 둡니다. 줄 길이가 조금씩 다른 것처럼 처음엔 같이
 * 흔들리다 점점 박자가 어긋나서, 판자 하나에 붙은 것처럼 한꺼번에 움직이지 않습니다.
 *
 * **움직일 때만 돕니다.** kick · gust 로 시작하고, 트랙이 서고 창 가까운 태그가 모두 가라앉고 바람이
 * 그치면 멈춥니다. 도는 중에 또 부르면 흔들리던 그대로 이어 받습니다 — 처음부터 다시 흔들면
 * 연달아 흘려 보낼 때 태그가 뚝 끊겼다가 새로 출렁입니다.
 *
 * 상태(useState)로 두지 않고 요소에 직접 씁니다. 상태로 두면 매 프레임 병 스물다섯
 * 개가 다시 그려집니다. 움직임을 줄이도록 설정한 사용자에게는 흔들지도, 바람을 일으키지도
 * 않습니다(무대도 곧바로 바뀝니다).
 *
 * ── 바람(gust) ─────────────────────────────────────────────
 * 무대가 위아래로 바뀔 때(ShelfDeck) 태그 아랫단이 보는 사람 쪽으로 들렸다 떨어집니다. 옆 흔들림과 같은
 * 프레임 루프가 함께 굴립니다. 도는 중에 불면 그 루프가 이어 받습니다.
 *
 *   - 태그마다 바람을 조금씩 다르게 받습니다(세기 · 난류 위상 · 창 가운데에서 먼 만큼 늦음 — lib.ts 의
 *     liftTarget). 한 장처럼 들리지 않습니다. 들린 만큼 창 가운데에서 바깥쪽으로 조금 벌어집니다.
 *   - 창 가까운 태그에만 data-lift · --tag-lift(보이는 들림) · --tag-lit(빛)을 쓰고, 창에서 멀어진
 *     태그에서는 뗍니다. CSS 가 data-lift 가 있을 때만 원근 회전을 걸어, 3D 층은 바람이 부는 동안에만
 *     생깁니다(shelf-display.css 의 .shelf-tag-hanger[data-lift]).
 *   - 부는 동안 패널 자리에 data-gust 를 걸어 패널 뒤 흐림을 끕니다 — 패널 밑 태그도 매 프레임 움직입니다.
 *   - 떠날 때는 무대가 다 빠진 뒤(LEAVE_END) 곧바로, 돌아올 때는 바람이 그치고 모든 태그가 가라앉으면
 *     전부 뗍니다.
 *
 * ── 그리는 비용 ─────────────────────────────────────────────
 * 옆 기울기는 합성 단계가 아니라 **다시 그리기**로 반영됩니다. 태그를 따로 합성 층으로
 * 올리면 그 위에 겹친 병 층(곱하기 · 흐림)이 줄줄이 따라 올라가 더 무거워집니다. 그래서
 *
 *   - 진자는 태그 전부 굴리되, 기울기는 **창 가까이 있는 태그에만** 씁니다. 창 밖 태그는
 *     마스크에 가려 보이지 않는데도 매 프레임 다시 그려지고 있었습니다. 창을 벗어난 태그에 남은
 *     기울기는 곧바로 떼고, 끝낼지도 창 가까운 태그로만 봅니다.
 *   - 그 태그에도 기울기가 0.05도(WRITE_STEP) 넘게 바뀐 프레임에만 씁니다. 가라앉는 끝자락의
 *     눈에 안 보이는 떨림까지 매 프레임 다시 그리지 않습니다.
 *   - 트랙 위치는 getBoundingClientRect 로 매 프레임 재지 않고 useShelfFlow 가 적어 둔
 *     transform 에서 읽습니다. 재면 프레임마다 레이아웃 계산을 한 번 더 강제합니다.
 *
 * 바람이 부는 동안만은 원근 회전 때문에 들린 태그가 따로 합성 층에 오릅니다. 창 가까운 열 개 남짓이
 * 무대가 바뀌는 1초 남짓 동안뿐이고, 묶음은 원래 쌓임 맥락이라 병 칸 · 병 상자에는 새로 생기지 않습니다.
 */
export function useTagSwing(
  track: RefObject<HTMLElement | null>,
  viewport: RefObject<HTMLElement | null>,
  panel: RefObject<HTMLElement | null>,
) {
  const frame = useRef(0)
  /** 지금 부는 바람. 불지 않으면 null 입니다 */
  const wind = useRef<Gust | null>(null)

  // 진열장이 사라지면(다른 화면으로 이동) 돌던 흔들림을 멈춥니다
  useEffect(() => () => cancelAnimationFrame(frame.current), [])

  return useMemo(() => {
    /** 프레임 루프를 시작합니다. 이미 돌고 있으면 그대로 두고, 도는 루프가 새 바람(wind)을 읽어 갑니다 */
    const run = () => {
      const element = track.current
      const view = viewport.current
      if (!element || !view || frame.current) return

      // 레이아웃은 시작할 때 한 번만 잽니다. 태그는 트랙과 함께 움직여 트랙 안 자리가 그대로입니다
      const trackBox = element.getBoundingClientRect()
      const viewBox = view.getBoundingClientRect()
      const startShift = shiftOf(element)
      const trackLeft = () => trackBox.left + shiftOf(element) - startShift

      const pendulums = [
        ...element.querySelectorAll<HTMLElement>('.shelf-tag-hanger'),
      ].map((hanger, at) => {
        const box = hanger.getBoundingClientRect()
        // 황금비 수열로 칸마다 고르게 흩어 둡니다 — 이웃한 태그끼리 박자가 겹치지 않게
        const spread = (at * 0.618034) % 1
        return {
          hanger,
          left: box.left - trackBox.left,
          right: box.right - trackBox.left,
          omega: ((2 * Math.PI) / PERIOD) * (0.9 + 0.2 * spread),
          swing: { angle: 0, speed: 0 } as Swing,
          /** 마지막으로 쓴 기울기(도). 흔들기 전에는 --tag-swing 이 없어 0 입니다 */
          written: 0,
          /** 앞으로 들린 기울기(라디안). 바람이 불 때만 움직입니다 */
          lift: { angle: 0, speed: 0 } as Swing,
          /** 바람을 받는 모양 — 세기 · 난류 위상 · 늦음(늦음은 바람마다 창 자리로 다시 셉니다) */
          tag: {
            gain: 0.85 + 0.3 * spread,
            phase: 2 * Math.PI * ((at * 0.381966) % 1),
            lag: 0,
          },
          /** 창 가운데에서 떨어진 쪽과 정도(−1 ~ 1). 들린 만큼 이쪽으로 벌어집니다 */
          fan: 0,
          /** 마지막으로 쓴 보이는 들림(도). 쓰지 않았으면(data-lift 없음) null 입니다 */
          lifted: null as number | null,
        }
      })
      type Pendulum = (typeof pendulums)[number]

      /** 들림 표시(data-lift · --tag-lift · --tag-lit)를 뗍니다 */
      const unlift = (pendulum: Pendulum) => {
        if (pendulum.lifted === null) return
        pendulum.hanger.removeAttribute('data-lift')
        pendulum.hanger.style.removeProperty('--tag-lift')
        pendulum.hanger.style.removeProperty('--tag-lit')
        pendulum.lifted = null
      }

      /** 바람이 그쳤습니다. 들림을 0 으로 두고 태그 · 패널 자리의 표시를 전부 뗍니다 */
      const calmWind = () => {
        for (const pendulum of pendulums) {
          pendulum.lift = { angle: 0, speed: 0 }
          unlift(pendulum)
        }
        panel.current?.removeAttribute('data-gust')
        wind.current = null
      }

      /** 태그마다 늦음 · 벌어질 쪽을 센 바람. 새 바람이 불면 그때 창 자리로 다시 셉니다 */
      let aimed: Gust | null = null
      const aim = (gust: Gust, x: number) => {
        aimed = gust
        const half = viewBox.width / 2
        const center = viewBox.left + half
        for (const pendulum of pendulums) {
          const offset =
            half > 0
              ? (x + (pendulum.left + pendulum.right) / 2 - center) / half
              : 0
          pendulum.tag.lag = LIFT_LAG * Math.min(1, Math.abs(offset))
          pendulum.fan = Math.min(1, Math.max(-1, offset))
        }
      }

      let lastX = trackLeft()
      let lastSpeed = 0
      let lastTime = performance.now()
      let calm = 0

      const tick = (now: number) => {
        const before = lastTime
        const elapsed = (now - before) / 1000
        lastTime = now
        const x = trackLeft()
        const gust = wind.current
        if (gust && gust !== aimed) aim(gust, x)
        /** 이 프레임에서 바람이 가라앉았는지. 진자를 굴리지 않은 프레임은 판단하지 않습니다(null) */
        let windCalm: boolean | null = null

        if (elapsed > GAP) {
          // 오래 멈췄다 돌아왔습니다. 위치만 새로 잡고 흔들지는 않습니다.
          // 프레임이 계속 이렇게 드문 환경이면 조용한 것으로 쳐서 곧 끝냅니다. 바람도 그친 것으로 칩니다
          lastX = x
          lastSpeed = 0
          calm += 1
          windCalm = true
        } else if (elapsed > 0) {
          /*
           * 속도 · 가속도는 **실제로 흐른 시간**으로 구합니다. 느린 기기에서 프레임이
           * 길어져도 같은 움직임이면 같은 값이 나옵니다(시간을 짧게 묶어 나누면 가속도가
           * 몇 배로 부풀어 태그가 한도까지 튕깁니다). 진자는 그 시간을 STEP 이하로
           * 쪼개 굴려서, 프레임이 길어도 발산하지 않고 실제 시간만큼 흔들립니다.
           */
          const speed = (x - lastX) / elapsed
          const accel = (speed - lastSpeed) / elapsed
          lastX = x
          lastSpeed = speed
          const steps = Math.ceil(elapsed / STEP)
          const step = elapsed / steps
          /** 바람을 일으킨 뒤 이 프레임 첫 걸음 직전까지 흐른 시간(초). 바람보다 앞선 프레임이면 음수입니다 */
          const since = gust ? (before - gust.t0) / 1000 : 0

          let settled = Math.abs(speed) < 1
          windCalm = true
          for (const pendulum of pendulums) {
            for (let at = 0; at < steps; at += 1) {
              /*
               * 바람이 불면 들림을 한 걸음 굴리고, 들린 만큼 창 바깥쪽으로 벌어지게 옆 가속도를 더합니다.
               * swingStep 이 GAIN 을 곱하므로 그만큼 나눠 두면, 이 힘만으로 기우는 각도가 들림 × LIFT_FAN
               * 입니다. 기울기가 양수면 아랫단이 왼쪽으로 가서, 창 오른쪽(fan > 0) 태그는 음수로 밀어야
               * 바깥으로 벌어집니다.
               */
              let fan = 0
              if (gust) {
                const t = since + step * (at + 1)
                pendulum.lift = liftStep(
                  pendulum.lift,
                  liftTarget(
                    t,
                    gust.direction,
                    LIFT_WIND[gust.direction],
                    pendulum.tag,
                  ),
                  step,
                  LIFT,
                )
                fan =
                  -(
                    pendulum.omega *
                    pendulum.omega *
                    LIFT_FAN *
                    pendulum.fan *
                    pendulum.lift.angle
                  ) / GAIN
              }
              pendulum.swing = swingStep(pendulum.swing, accel + fan, step, {
                omega: pendulum.omega,
                damping: DAMPING,
                gain: GAIN,
                limit: LIMIT,
              })
            }
            const { angle, speed: turning } = pendulum.swing
            const near =
              x + pendulum.right > viewBox.left - MARGIN &&
              x + pendulum.left < viewBox.right + MARGIN
            /*
             * 끝낼지는 창 가까운 태그로만 봅니다. 창 밖 태그는 마스크에 가려 보이지 않는데, 크게 흔들리며
             * 창을 벗어난 태그의 잔떨림까지 기다리면 보이는 태그가 다 멎은 뒤에도 한참 더 돕니다.
             */
            if (
              near &&
              (Math.abs(angle) > REST || Math.abs(turning) > REST * 10)
            ) {
              settled = false
            }
            const degrees = (angle * 180) / Math.PI
            if (!near) {
              // 창을 벗어난 태그에 남은 기울기는 곧바로 뗍니다 — 흔들던 값이 루프가 끝날 때까지 붙어 있지 않게
              if (pendulum.written !== 0) {
                pendulum.hanger.style.removeProperty('--tag-swing')
                pendulum.written = 0
              }
            } else if (Math.abs(degrees - pendulum.written) >= WRITE_STEP) {
              pendulum.hanger.style.setProperty(
                '--tag-swing',
                `${degrees.toFixed(3)}deg`,
              )
              pendulum.written = degrees
            }

            if (!gust) continue
            const { angle: lifting, speed: rising } = pendulum.lift
            if (
              since + elapsed - pendulum.tag.lag <
                LIFT_ENVELOPE[gust.direction].end ||
              Math.abs(lifting) >= LIFT_REST ||
              Math.abs(rising) >= LIFT_REST * 10
            ) {
              windCalm = false
            }
            if (!near) {
              unlift(pendulum)
              continue
            }
            const shown = LIFT_CAP * Math.tanh(lifting / LIFT_CAP)
            const shownDegrees = shown / DEG
            if (Math.abs(shownDegrees - (pendulum.lifted ?? 0)) >= WRITE_STEP) {
              if (pendulum.lifted === null) {
                pendulum.hanger.setAttribute('data-lift', '')
              }
              pendulum.hanger.style.setProperty(
                '--tag-lift',
                `${shownDegrees.toFixed(3)}deg`,
              )
              // 아랫단이 앞으로 들리면 왼쪽 위 광원을 향해 밝아집니다. 벽 쪽으로 넘어가면 0 입니다
              pendulum.hanger.style.setProperty(
                '--tag-lit',
                Math.min(1, Math.max(0, Math.sin(shown) / LIFT_LIT)).toFixed(3),
              )
              pendulum.lifted = shownDegrees
            }
          }
          calm = settled ? calm + 1 : 0
        }

        if (gust) {
          const over =
            gust.direction === 'leave'
              ? (now - gust.t0) / 1000 >= LEAVE_END
              : windCalm === true
          // 부는 동안에는 트랙 · 옆 흔들림이 조용해도 루프를 끝내지 않습니다
          if (over) calmWind()
          else calm = 0
        }

        if (calm > CALM_FRAMES) {
          for (const { hanger } of pendulums) {
            hanger.style.removeProperty('--tag-swing')
          }
          frame.current = 0
          return
        }
        frame.current = requestAnimationFrame(tick)
      }
      frame.current = requestAnimationFrame(tick)
    }

    const reduced = () =>
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

    return {
      /** 트랙이 움직이기 시작할 때 부릅니다 */
      kick: () => {
        if (reduced()) return
        run()
      },
      /** 무대를 바꾸기 직전에 부릅니다(ShelfWallHandle 의 gust) */
      gust: (direction: GustDirection) => {
        if (reduced()) return
        wind.current = { t0: performance.now(), direction }
        run()
        // 벽을 그리기 전(크기를 재기 전)이라 루프가 시작되지 않았으면 들 태그가 없습니다
        if (!frame.current) {
          wind.current = null
          return
        }
        panel.current?.setAttribute('data-gust', '')
      },
    }
  }, [panel, track, viewport])
}
