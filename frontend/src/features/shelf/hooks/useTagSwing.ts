import { useCallback, useEffect, useRef, type RefObject } from 'react'

import { swingStep, type Swing } from '../lib'

/** 한 번 오가는 주기(초). 짧으면 파르르 떨리고, 길면 둔하게 출렁입니다 */
const PERIOD = 0.95

/** 감쇠비. 두세 번 오가다 2초 남짓이면 눈에 띄지 않을 만큼 가라앉습니다 */
const DAMPING = 0.16

/**
 * 트랙 가속도(px/s²)를 태그의 각가속도로 바꾸는 비율.
 *
 * 실제 줄 길이(50px 남짓)로 계산하면 트랙이 워낙 빨라서 태그가 뒤집힐 만큼
 * 휘둘립니다. 데스크톱에서 병 두세 개를 한 번에 흘려 보낼 때 10도 안쪽으로 흔들리도록
 * 맞춘 값입니다. 창이 좁아 트랙이 덜 움직이면 흔들림도 그만큼 작아집니다.
 */
const GAIN = 1 / 1800

/** 아무리 세게 밀어도 이 기울기(14도)를 넘지 않습니다 */
const LIMIT = (14 * Math.PI) / 180

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

/** 트랙에 useShelfFlow 가 적어 둔 가로 이동(px) */
const shiftOf = (element: HTMLElement) =>
  Number(/translate3d\((-?[\d.]+)px/.exec(element.style.transform)?.[1] ?? 0)

/**
 * 트랙이 옆으로 움직일 때 줄에 매달린 이름표를 흔듭니다. 돌려주는 함수(kick)를
 * 트랙이 움직이기 시작할 때 부르세요.
 *
 * 트랙의 실제 위치를 매 프레임 읽어 가속도를 구하고, 태그마다 감쇠 진자
 * (`swingStep`)를 한 프레임씩 굴려 그 기울기를 `--tag-swing` 으로 넣습니다.
 * CSS 의 `.shelf-tag-hanger` 가 줄이 병에 걸린 점을 축으로 그만큼 돌립니다.
 * 트랙을 무엇이 움직였는지는 따지지 않습니다 — 휠이든 칩이든 하단 페이저든 위치만
 * 읽어서 쓰므로 같은 식으로 흔들립니다.
 *
 * 태그마다 주기를 ±10% 다르게 둡니다. 줄 길이가 조금씩 다른 것처럼 처음엔 같이
 * 흔들리다 점점 박자가 어긋나서, 판자 하나에 붙은 것처럼 한꺼번에 움직이지 않습니다.
 *
 * **움직일 때만 돕니다.** kick 으로 시작하고, 트랙이 서고 모든 태그가 가라앉으면
 * 멈춥니다. 도는 중에 또 부르면 흔들리던 그대로 이어 받습니다 — 처음부터 다시 흔들면
 * 연달아 흘려 보낼 때 태그가 뚝 끊겼다가 새로 출렁입니다.
 *
 * 상태(useState)로 두지 않고 요소에 직접 씁니다. 상태로 두면 매 프레임 병 스물다섯
 * 개가 다시 그려집니다. 움직임을 줄이도록 설정한 사용자에게는 흔들지 않습니다.
 *
 * ── 그리는 비용 ─────────────────────────────────────────────
 * 태그 기울기는 합성 단계가 아니라 **다시 그리기**로 반영됩니다. 태그를 따로 합성 층으로
 * 올리면 그 위에 겹친 병 층(곱하기 · 흐림)이 줄줄이 따라 올라가 더 무거워집니다. 그래서
 *
 *   - 진자는 태그 전부 굴리되, 기울기는 **창 가까이 있는 태그에만** 씁니다. 창 밖 태그는
 *     마스크에 가려 보이지 않는데도 매 프레임 다시 그려지고 있었습니다.
 *   - 트랙 위치는 getBoundingClientRect 로 매 프레임 재지 않고 useShelfFlow 가 적어 둔
 *     transform 에서 읽습니다. 재면 프레임마다 레이아웃 계산을 한 번 더 강제합니다.
 */
export function useTagSwing(
  track: RefObject<HTMLElement | null>,
  viewport: RefObject<HTMLElement | null>,
) {
  const frame = useRef(0)

  // 진열장이 사라지면(다른 화면으로 이동) 돌던 흔들림을 멈춥니다
  useEffect(() => () => cancelAnimationFrame(frame.current), [])

  return useCallback(() => {
    const element = track.current
    const view = viewport.current
    if (!element || !view || frame.current) return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return

    // 레이아웃은 시작할 때 한 번만 잽니다. 태그는 트랙과 함께 움직여 트랙 안 자리가 그대로입니다
    const trackBox = element.getBoundingClientRect()
    const viewBox = view.getBoundingClientRect()
    const startShift = shiftOf(element)
    const trackLeft = () => trackBox.left + shiftOf(element) - startShift

    const pendulums = [
      ...element.querySelectorAll<HTMLElement>('.shelf-tag-hanger'),
    ].map((hanger, at) => {
      const box = hanger.getBoundingClientRect()
      return {
        hanger,
        left: box.left - trackBox.left,
        right: box.right - trackBox.left,
        // 황금비 수열로 칸마다 고르게 흩어 둡니다 — 이웃한 태그끼리 박자가 겹치지 않게
        omega: ((2 * Math.PI) / PERIOD) * (0.9 + 0.2 * ((at * 0.618034) % 1)),
        swing: { angle: 0, speed: 0 } as Swing,
      }
    })

    let lastX = trackLeft()
    let lastSpeed = 0
    let lastTime = performance.now()
    let calm = 0

    const tick = (now: number) => {
      const elapsed = (now - lastTime) / 1000
      lastTime = now
      const x = trackLeft()

      if (elapsed > GAP) {
        // 오래 멈췄다 돌아왔습니다. 위치만 새로 잡고 흔들지는 않습니다.
        // 프레임이 계속 이렇게 드문 환경이면 조용한 것으로 쳐서 곧 끝냅니다
        lastX = x
        lastSpeed = 0
        calm += 1
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

        let settled = Math.abs(speed) < 1
        for (const pendulum of pendulums) {
          for (let at = 0; at < steps; at += 1) {
            pendulum.swing = swingStep(pendulum.swing, accel, step, {
              omega: pendulum.omega,
              damping: DAMPING,
              gain: GAIN,
              limit: LIMIT,
            })
          }
          const { angle, speed: turning } = pendulum.swing
          if (Math.abs(angle) > REST || Math.abs(turning) > REST * 10) {
            settled = false
          }
          const near =
            x + pendulum.right > viewBox.left - MARGIN &&
            x + pendulum.left < viewBox.right + MARGIN
          if (near) {
            pendulum.hanger.style.setProperty(
              '--tag-swing',
              `${((angle * 180) / Math.PI).toFixed(3)}deg`,
            )
          }
        }
        calm = settled ? calm + 1 : 0
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
  }, [track, viewport])
}
