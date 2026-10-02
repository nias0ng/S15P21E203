import { useId } from 'react'

import { useIsRising } from '@/shared/store/diveStore'

/**
 * 진열대 벽 — 선실의 회벽과 질감, 그 아래 징두리 판벽. 진열대(MyShelfPage)와 컬렉션 상세가 같이 깔아서,
 * 진열함을 눌러 상세로 넘어가도 같은 벽 앞에 섭니다. `.shelf-scope` 안에 둡니다(팔레트가 거기 있습니다).
 *
 * 판벽은 진열대가 궤짝 아래끝을 알려야(`useWainscotAnchor`) 섭니다. 알리는 진열대가 없는 컬렉션 상세와
 * 쌓는 배치에서는 회벽만 보입니다.
 *
 * fixed 로 뷰포트를 통째로 덮습니다 — 본문 div 에만 배경을 깔면 좌우 여백과 화면 아래쪽이 body 의
 * ivory 로 남아 종이 한 장 느낌이 끊깁니다. -z-10 이라 본문 뒤, 헤더(bg-surface · z-20) 아래에
 * 깔립니다.
 *
 * 질감(shelf-grain)을 본문이 아니라 이 레이어에 얹는 이유: 노이즈는 mix-blend-mode 로 밑을
 * 곱하는데, 본문 위에 두면 새 쌓임 맥락이 생겨 Toast(fixed)와 모달이 그 아래로 밀립니다.
 */
export function ShelfPaper() {
  // 메인으로 떠오르는 중인가(헤더 로고). useIsDiving 은 들어올 때도 참이라 쓰지 않습니다
  const rising = useIsRising()

  return (
    <div
      aria-hidden
      className="shelf-paper shelf-grain fixed inset-0 -z-10"
      data-rising={rising ? '' : undefined}
    >
      {/*
        징두리 판벽 — 회벽 위 · 결 아래 · 내용 뒤(-z-10)입니다. 높이와 까닭은 shelf-display.css 의
        .shelf-wainscot 에 있습니다. 헤더도 회벽을 칠하므로 판벽은 바탕이 아니라 이 겹에 그립니다.
      */}
      <i className="shelf-wainscot" />
      {/* 시안: 내 컬렉션 무대(아래층 선창) — 계단과 어둠 */}
      <CabinStairs />
      <i className="shelf-hold" />
      <ShipLantern />
      {/*
        떠오르기 시작하면 **방이 한 단 가라앉습니다.** 커튼이 위에서 덮기 전 0.3초 동안 화면에서
        움직이는 것이 이것 하나입니다 (나가는 길에서 카메라가 먼저 고개를 숙이는 것과 같은 자리).
      */}
      <i className="shelf-deepen" />
    </div>
  )
}

/*
 * ───────── 시안: 낡은 선창 계단 ─────────
 *
 * 오른쪽 아래 바닥에서 왼쪽 위로 올라 화면 위로 빠져나가는 가파른 선창 계단. 두꺼운 옆판(멍에) 위에
 * 닳은 디딤판이 얹히고, 밑은 거친 받침 기둥 둘이 받칩니다. 아래끝에 굵은 기둥, 옆에는 쇠 기둥 사이로 처진
 * 밧줄 난간. 낡은 느낌은 판자 모양을 흔들지 않고 결 · 얼룩 · 못 · 닳은 자국으로 냅니다 — 조각마다 따로
 * 흔들면 맞닿는 이음매(디딤판 · 챌판 · 옆판)가 어긋나 벽이 비치는 틈이 생깁니다. 맞물리는 꼭짓점은
 * 모두 같은 좌표에서 셈합니다.
 *
 * 결은 화면 크기 필터가 아니라 작은 무늬 조각(pattern)에 한 번만 굽고 되풀이합니다.
 * 좌표는 1600 x 900 판 기준이고, 오른쪽 아래에 붙여 화면을 덮습니다(slice).
 */
const FLOOR = 872
const RISE = 92
const RUN = 96
const STEPS = 11
const START = 1490
const D = { x: 58, y: -30 }
const TREAD = 20
const NOSE = 12
const STRINGER = 175
const PITCH_DEG = (Math.atan2(RISE, RUN) * 180) / Math.PI

type Point = readonly [number, number]

const pts = (list: readonly Point[]) =>
  list.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')

function CabinStairs() {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '')
  const steps = Array.from({ length: STEPS }, (_, i) => ({
    i,
    top: FLOOR - (i + 1) * RISE,
    left: START - (i + 1) * RUN,
    right: START - i * RUN,
  }))
  type Step = (typeof steps)[number]
  // 챌판 — 밑변을 2 만큼 아래 디딤판 밑으로 묻습니다. 딱 맞대면 맞닿는 선에 벽이 실처럼 비칩니다
  const riser = (s: Step): Point[] => [
    [s.right, s.top + TREAD],
    [s.right, s.top + RISE + 2],
    [s.right + D.x, s.top + RISE + D.y + 2],
    [s.right + D.x, s.top + TREAD + D.y],
  ]
  // 디딤판 윗면 · 앞 마구리 · 코 — 세 면이 같은 네 꼭짓점(앞 왼쪽 · 앞 오른쪽 · 깊이 D)을 나눠 씁니다
  const treadTop = (s: Step): Point[] => [
    [s.left, s.top],
    [s.right + NOSE, s.top],
    [s.right + NOSE + D.x, s.top + D.y],
    [s.left + D.x, s.top + D.y],
  ]
  const treadFront = (s: Step): Point[] => [
    [s.left, s.top],
    [s.right + NOSE, s.top],
    [s.right + NOSE, s.top + TREAD],
    [s.left, s.top + TREAD],
  ]
  const nose = (s: Step): Point[] => [
    [s.right + NOSE, s.top],
    [s.right + NOSE, s.top + TREAD],
    [s.right + NOSE + D.x, s.top + TREAD + D.y],
    [s.right + NOSE + D.x, s.top + D.y],
  ]
  // 발이 닿아 바랜 자리 — 윗면 안쪽에 같은 비율로 들인 판이라 디딤판 밖으로 삐져나가지 않습니다
  const worn = (s: Step): Point[] => {
    const q = treadTop(s)
    const at = (u: number, v: number): Point => {
      const [a, b, c, d] = q as [Point, Point, Point, Point]
      const top: Point = [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]
      const back: Point = [d[0] + (c[0] - d[0]) * u, d[1] + (c[1] - d[1]) * u]
      return [top[0] + (back[0] - top[0]) * v, top[1] + (back[1] - top[1]) * v]
    }
    return [at(0.12, 0.2), at(0.82, 0.2), at(0.82, 0.8), at(0.12, 0.8)]
  }

  // 옆판 — 윗변은 디딤판 밑을 따라 톱니, 밑변은 기울기와 나란한 곧은 선
  const top = FLOOR - STEPS * RISE
  const leftEnd = START - STEPS * RUN
  const stringer: Point[] = [[START + NOSE, FLOOR]]
  for (const s of steps) {
    stringer.push([s.right + (s.i === 0 ? NOSE : 0), s.top + TREAD])
    stringer.push([s.left, s.top + TREAD])
  }
  const underStart: Point = [leftEnd, top + STRINGER]
  const underEnd: Point = [START - (STRINGER * RUN) / RISE, FLOOR]
  stringer.push(underStart, underEnd)
  const underAt = (x: number) =>
    underStart[1] +
    ((x - underStart[0]) / (underEnd[0] - underStart[0])) *
      (underEnd[1] - underStart[1])

  // 계단 밑 그늘 — 옆판 밑변을 따라 띠로 깔고 기울기에 수직으로 풀립니다. 세모로 깔면 왼쪽 변이 세로로 서서 판처럼 보입니다
  const len = Math.hypot(RUN, RISE)
  const normal = { x: -RISE / len, y: RUN / len }
  const SHADE = 300
  // 위끝은 계단을 따라 화면 위 밖까지 늘립니다 — 띠의 잘린 끝이 화면 안에 서면 세모난 금이 보입니다
  const shadeTop: Point = [
    underStart[0] - (RUN / len) * 700,
    underStart[1] - (RISE / len) * 700,
  ]
  const shadow: Point[] = [
    shadeTop,
    underEnd,
    [underEnd[0] + normal.x * SHADE, underEnd[1] + normal.y * SHADE],
    [shadeTop[0] + normal.x * SHADE, shadeTop[1] + normal.y * SHADE],
  ]
  const shadeFrom: Point = [
    (underStart[0] + underEnd[0]) / 2,
    (underStart[1] + underEnd[1]) / 2,
  ]

  // 받침 기둥 둘
  const posts = [1120, 790].map((x) => ({ x, y: underAt(x) - 8 }))

  // 난간 — 아래끝 굵은 기둥 꼭대기에서 세 칸마다 선 쇠 기둥으로 밧줄이 처지며 이어집니다
  const newel = { x: START + 20, w: 46, top: FLOOR - 250 }
  const stanchions = [2, 5, 8].map((i) => {
    const s = steps[i] ?? steps[0]
    const x = (s?.left ?? 0) + RUN * 0.55 + D.x * 0.2
    const y = (s?.top ?? 0) + D.y * 0.2
    return { x, base: y, top: y - 150 }
  })
  const ropeAnchors: Point[] = [
    [newel.x + newel.w / 2, newel.top + 14],
    ...stanchions.map((p): Point => [p.x, p.top + 6]),
    [leftEnd - 60, top - 150],
  ]
  let rope = `M ${ropeAnchors[0]?.[0]} ${ropeAnchors[0]?.[1]}`
  for (let k = 1; k < ropeAnchors.length; k++) {
    const a = ropeAnchors[k - 1]
    const b = ropeAnchors[k]
    if (!a || !b) continue
    const sag = Math.hypot(b[0] - a[0], b[1] - a[1]) * 0.09
    rope += ` Q ${(a[0] + b[0]) / 2} ${(a[1] + b[1]) / 2 + sag} ${b[0]} ${b[1]}`
  }

  const backToFront = [...steps].reverse()
  const grain = (
    name: string,
    w: number,
    h: number,
    bx: string,
    by: string,
    rotate = 0,
  ) => (
    <pattern
      id={`${id}${name}`}
      width={w}
      height={h}
      patternUnits="userSpaceOnUse"
      patternTransform={rotate ? `rotate(${rotate})` : undefined}
    >
      <filter id={`${id}${name}f`} x="0" y="0" width="100%" height="100%">
        <feTurbulence
          type="fractalNoise"
          baseFrequency={`${bx} ${by}`}
          numOctaves={3}
          seed={w + h}
          stitchTiles="stitch"
        />
        <feColorMatrix values="0 0 0 0 0.06 0 0 0 0 0.04 0 0 0 0 0.02 3 0 0 0 -1.3" />
      </filter>
      <filter id={`${id}${name}l`} x="0" y="0" width="100%" height="100%">
        <feTurbulence
          type="fractalNoise"
          baseFrequency={`${Number(bx) * 0.5} ${Number(by) * 0.25}`}
          numOctaves={2}
          seed={w}
          stitchTiles="stitch"
        />
        <feColorMatrix values="0 0 0 0 0.8 0 0 0 0 0.68 0 0 0 0 0.5 2.2 0 0 0 -1.15" />
      </filter>
      <rect
        width={w}
        height={h}
        filter={`url(#${id}${name}l)`}
        opacity="0.45"
      />
      <rect width={w} height={h} filter={`url(#${id}${name}f)`} />
    </pattern>
  )

  return (
    <div className="shelf-stairs shelf-lower" aria-hidden>
      <svg
        viewBox="0 0 1600 900"
        preserveAspectRatio="xMaxYMax slice"
        className="h-full w-full"
      >
        <defs>
          {grain('h', 640, 200, '0.004', '0.07')}
          {grain('r', 640, 200, '0.004', '0.07', PITCH_DEG)}
          {grain('v', 200, 640, '0.07', '0.004')}
          <radialGradient id={`${id}wear`}>
            <stop offset="0" stopColor="oklch(0.66 0.05 74 / 0.42)" />
            <stop offset="1" stopColor="oklch(0.66 0.05 74 / 0)" />
          </radialGradient>
          <radialGradient id={`${id}stain`}>
            <stop offset="0" stopColor="oklch(0.12 0.02 48 / 0.6)" />
            <stop offset="1" stopColor="oklch(0.12 0.02 48 / 0)" />
          </radialGradient>
          <clipPath id={`${id}room`}>
            <rect width="1600" height={FLOOR} />
          </clipPath>
          <clipPath id={`${id}sc`}>
            <polygon points={pts(stringer)} />
          </clipPath>
          {/* 계단 밑 어둠 — 옆판 밑에서 짙고, 왼쪽 아래(벽 쪽)로 갈수록 풀립니다. 끝이 딱 끊기면 판이 서 보입니다 */}
          <linearGradient
            id={`${id}under`}
            gradientUnits="userSpaceOnUse"
            x1={shadeFrom[0]}
            y1={shadeFrom[1]}
            x2={shadeFrom[0] + normal.x * SHADE}
            y2={shadeFrom[1] + normal.y * SHADE}
          >
            <stop offset="0" stopColor="oklch(0.12 0.015 48 / 0.6)" />
            <stop offset="0.55" stopColor="oklch(0.12 0.015 48 / 0.22)" />
            <stop offset="1" stopColor="oklch(0.12 0.015 48 / 0)" />
          </linearGradient>
        </defs>

        {/* 바닥 — 짙은 판자 */}
        <rect
          x="0"
          y={FLOOR}
          width="1600"
          height={900 - FLOOR}
          fill="oklch(0.27 0.03 52)"
        />
        <rect
          x="0"
          y={FLOOR}
          width="1600"
          height={900 - FLOOR}
          fill={`url(#${id}h)`}
        />
        <rect
          x="0"
          y={FLOOR}
          width="1600"
          height="2"
          fill="oklch(0.46 0.04 64 / 0.8)"
        />

        {/* 계단 밑 어둠 — 바닥 아래로 내려간 몫은 잘라 냅니다 */}
        <g clipPath={`url(#${id}room)`}>
          <polygon points={pts(shadow)} fill={`url(#${id}under)`} />
        </g>

        {/* 받침 기둥 — 거친 각목에 쇠 띠 */}
        {posts.map((p) => (
          <g key={p.x}>
            <rect
              x={p.x - 18}
              y={p.y}
              width="36"
              height={FLOOR - p.y}
              fill="oklch(0.26 0.03 52)"
            />
            <rect
              x={p.x - 18}
              y={p.y}
              width="36"
              height={FLOOR - p.y}
              fill={`url(#${id}v)`}
            />
            <rect
              x={p.x - 19}
              y={p.y + 18}
              width="38"
              height="9"
              fill="oklch(0.22 0.008 60)"
            />
            <circle
              cx={p.x - 9}
              cy={p.y + 22.5}
              r="2.4"
              fill="oklch(0.5 0.01 70)"
            />
            <circle
              cx={p.x + 9}
              cy={p.y + 22.5}
              r="2.4"
              fill="oklch(0.5 0.01 70)"
            />
          </g>
        ))}

        {/* 챌판 — 위에서부터 그려 아래 계단이 앞에 옵니다 */}
        {backToFront.map((s) => (
          <g key={`riser${s.i}`}>
            <polygon points={pts(riser(s))} fill="oklch(0.22 0.028 50)" />
            <polygon points={pts(riser(s))} fill={`url(#${id}h)`} />
            <polygon
              points={pts([
                [s.right, s.top + TREAD],
                [s.right, s.top + TREAD + 16],
                [s.right + D.x, s.top + TREAD + 16 + D.y],
                [s.right + D.x, s.top + TREAD + D.y],
              ])}
              fill="oklch(0.1 0.012 48 / 0.65)"
            />
          </g>
        ))}

        {/* 디딤판 — 윗면 · 앞 코 · 발이 닿아 바랜 가운데 */}
        {backToFront.map((s) => (
          <g key={`tread${s.i}`}>
            <polygon points={pts(treadTop(s))} fill="oklch(0.36 0.04 58)" />
            <polygon points={pts(treadTop(s))} fill={`url(#${id}h)`} />
            <polygon points={pts(worn(s))} fill={`url(#${id}wear)`} />
            <polygon points={pts(nose(s))} fill="oklch(0.42 0.045 62)" />
            <polygon points={pts(nose(s))} fill={`url(#${id}h)`} />
          </g>
        ))}

        {/* 옆판 — 결이 기울기를 따라 흐르고, 판 이음이 두 줄 납니다 */}
        <polygon points={pts(stringer)} fill="oklch(0.28 0.034 53)" />
        <polygon points={pts(stringer)} fill={`url(#${id}r)`} />
        <g clipPath={`url(#${id}sc)`}>
          {/* 판 이음 두 줄 — 옆판 밑변과 같은 기울기라 끝까지 나란합니다 */}
          {[0.42, 0.74].map((f) => {
            const y0 = top + TREAD + (STRINGER - TREAD) * f
            const x1 = START + 60
            return (
              <line
                key={f}
                x1={leftEnd}
                y1={y0}
                x2={x1}
                y2={y0 + ((x1 - leftEnd) * RISE) / RUN}
                stroke="oklch(0.12 0.015 48 / 0.7)"
                strokeWidth="2"
              />
            )
          })}
          {[
            [1260, 690, 60, 26],
            [930, 400, 70, 30],
            [640, 150, 50, 22],
          ].map(([cx, cy, rx, ry]) => (
            <ellipse
              key={`${cx}`}
              cx={cx}
              cy={cy}
              rx={rx}
              ry={ry}
              fill={`url(#${id}stain)`}
            />
          ))}
        </g>
        {/* 디딤판 마구리 — 옆판 위에 얹힌 판 끝. 쇠못 둘 */}
        {steps.map((s) => (
          <g key={`edge${s.i}`}>
            <polygon points={pts(treadFront(s))} fill="oklch(0.44 0.045 64)" />
            <polygon points={pts(treadFront(s))} fill={`url(#${id}v)`} />
            <circle
              cx={s.left + 14}
              cy={s.top + TREAD + 14}
              r="2.6"
              fill="oklch(0.16 0.008 55)"
            />
            <circle
              cx={s.right - 14}
              cy={s.top + TREAD + 14}
              r="2.6"
              fill="oklch(0.16 0.008 55)"
            />
          </g>
        ))}

        {/* 아래끝 굵은 기둥 */}
        <rect
          x={newel.x}
          y={newel.top}
          width={newel.w}
          height={FLOOR - newel.top}
          fill="oklch(0.3 0.035 54)"
        />
        <rect
          x={newel.x}
          y={newel.top}
          width={newel.w}
          height={FLOOR - newel.top}
          fill={`url(#${id}v)`}
        />
        <rect
          x={newel.x - 5}
          y={newel.top - 14}
          width={newel.w + 10}
          height="16"
          fill="oklch(0.36 0.04 58)"
        />
        <rect
          x={newel.x - 5}
          y={newel.top - 14}
          width={newel.w + 10}
          height="3"
          fill="oklch(0.5 0.045 66)"
        />
        <rect
          x={newel.x + newel.w - 8}
          y={newel.top}
          width="8"
          height={FLOOR - newel.top}
          fill="oklch(0.14 0.015 48 / 0.5)"
        />

        {/* 쇠 기둥 */}
        {stanchions.map((p) => (
          <g key={p.x}>
            <rect
              x={p.x - 3}
              y={p.top}
              width="6"
              height={p.base - p.top}
              fill="oklch(0.22 0.008 60)"
            />
            <rect
              x={p.x - 2}
              y={p.top}
              width="1.6"
              height={p.base - p.top}
              fill="oklch(0.45 0.01 70 / 0.6)"
            />
            <circle
              cx={p.x}
              cy={p.top + 4}
              r="7"
              fill="none"
              stroke="oklch(0.24 0.008 60)"
              strokeWidth="3"
            />
          </g>
        ))}

        {/* 밧줄 난간 — 꼰 자국은 점선으로 */}
        <path
          d={rope}
          fill="none"
          stroke="oklch(0.2 0.02 55 / 0.35)"
          strokeWidth="13"
          transform="translate(3 6)"
        />
        <path
          d={rope}
          fill="none"
          stroke="oklch(0.56 0.05 76)"
          strokeWidth="11"
          strokeLinecap="round"
        />
        <path
          d={rope}
          fill="none"
          stroke="oklch(0.34 0.04 64)"
          strokeWidth="11"
          strokeDasharray="2.5 5"
        />
        <path
          d={rope}
          fill="none"
          stroke="oklch(0.72 0.05 82 / 0.7)"
          strokeWidth="2"
          transform="translate(-1 -3)"
        />
      </svg>
    </div>
  )
}

/*
 * ───────── 시안: 매달린 등불 ─────────
 *
 * 헤더 밑(천장)에서 쇠사슬로 내려온 기름 등불. 쇠 갓 · 놋쇠 띠 · 그을린 유리 · 철망 · 불꽃. 둘레의 빛은
 * CSS(.shelf-lantern::before)가 벽에 고이게 하고 조금씩 일렁입니다.
 */
function ShipLantern() {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '')
  return (
    <>
      {/* 빛과 등불을 따로 담습니다 — 빛만 벽과 screen 으로 섞습니다(.shelf-lantern-light) */}
      <div className="shelf-lower shelf-lantern-light" aria-hidden>
        <div className="shelf-lantern-glow" />
      </div>
      <div className="shelf-lower" aria-hidden>
        <div className="shelf-lantern">
          <svg viewBox="0 0 60 112" className="relative h-auto w-full">
            <defs>
              <radialGradient id={`${id}g`} cx="0.5" cy="0.55" r="0.6">
                <stop offset="0" stopColor="oklch(0.98 0.07 92)" />
                <stop offset="0.45" stopColor="oklch(0.88 0.13 78)" />
                <stop offset="1" stopColor="oklch(0.62 0.13 58 / 0.9)" />
              </radialGradient>
              <linearGradient id={`${id}soot`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="oklch(0.2 0.02 50 / 0.7)" />
                <stop offset="1" stopColor="oklch(0.2 0.02 50 / 0)" />
              </linearGradient>
              <radialGradient id={`${id}f`} cx="0.5" cy="0.65" r="0.5">
                <stop offset="0" stopColor="oklch(1 0.03 95)" />
                <stop offset="0.6" stopColor="oklch(0.9 0.15 80)" />
                <stop offset="1" stopColor="oklch(0.75 0.17 55 / 0)" />
              </radialGradient>
            </defs>
            {/* 쇠사슬 */}
            {[0, 1, 2, 3, 4].map((k) =>
              k % 2 === 0 ? (
                <ellipse
                  key={k}
                  cx="30"
                  cy={2.5 + k * 4.4}
                  rx="2.2"
                  ry="3"
                  fill="none"
                  stroke="oklch(0.24 0.01 60)"
                  strokeWidth="1.6"
                />
              ) : (
                <rect
                  key={k}
                  x="29.3"
                  y={k * 4.4}
                  width="1.4"
                  height="5.4"
                  fill="oklch(0.24 0.01 60)"
                />
              ),
            )}
            {/* 고리 */}
            <circle
              cx="30"
              cy="26"
              r="4.6"
              fill="none"
              stroke="oklch(0.22 0.01 60)"
              strokeWidth="2.4"
            />
            {/* 굴뚝 · 갓 */}
            <rect
              x="26.5"
              y="29"
              width="7"
              height="6"
              fill="oklch(0.2 0.01 60)"
            />
            <polygon
              points="15,44 45,44 38,34 22,34"
              fill="oklch(0.23 0.012 60)"
            />
            <polygon
              points="22,34 38,34 39,36 21,36"
              fill="oklch(0.42 0.02 70 / 0.8)"
            />
            {/* 놋쇠 띠 */}
            <rect
              x="14"
              y="44"
              width="32"
              height="4.5"
              rx="1"
              fill="oklch(0.62 0.09 80)"
            />
            <rect
              x="14"
              y="44"
              width="32"
              height="1.2"
              fill="oklch(0.82 0.08 88)"
            />
            {/* 유리 · 불빛 · 그을음 */}
            <rect
              x="17"
              y="48.5"
              width="26"
              height="36"
              rx="5"
              fill={`url(#${id}g)`}
            />
            <ellipse cx="30" cy="69" rx="5" ry="9" fill={`url(#${id}f)`} />
            <rect
              x="17"
              y="48.5"
              width="26"
              height="12"
              rx="5"
              fill={`url(#${id}soot)`}
            />
            {/* 철망 */}
            {[20, 26.5, 33.5, 40].map((x) => (
              <rect
                key={x}
                x={x - 0.8}
                y="48.5"
                width="1.6"
                height="36"
                fill="oklch(0.22 0.012 60 / 0.9)"
              />
            ))}
            <rect
              x="16.5"
              y="58"
              width="27"
              height="1.4"
              fill="oklch(0.22 0.012 60 / 0.85)"
            />
            <rect
              x="16.5"
              y="74"
              width="27"
              height="1.4"
              fill="oklch(0.22 0.012 60 / 0.85)"
            />
            {/* 받침 */}
            <rect
              x="14"
              y="84.5"
              width="32"
              height="4.5"
              rx="1"
              fill="oklch(0.58 0.09 78)"
            />
            <polygon
              points="17,89 43,89 39,98 21,98"
              fill="oklch(0.22 0.012 60)"
            />
            <rect
              x="24"
              y="98"
              width="12"
              height="3"
              fill="oklch(0.18 0.01 60)"
            />
          </svg>
        </div>
      </div>
    </>
  )
}
