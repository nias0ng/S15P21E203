/**
 * 잉크가 종이에 스며들듯 번지는 덮개 — 선실로 들어가기의 커튼이 구름을 이 모양으로 칠합니다
 * (`shared/ui/DiveCurtain`). 색은 모릅니다 — 알파만 냅니다.
 *
 * 둥근 그라데이션 한 장을 키우면 **원판**으로 읽힙니다 — 모양이 완벽한 원이고, 같은 모양이 커지기만
 * 하기 때문입니다. 그래서 화면에 고정된 **결**(노이즈)을 깔고, 한 점에서 퍼지는 앞선이 그 결을 따라
 * 들쭉날쭉 나아가게 합니다. 결이 낮은 자리는 먼저 젖고 높은 자리는 늦게 젖어, 앞선이 갈래를 뻗으며
 * 번집니다 — 종이에 떨어진 잉크가 섬유를 따라 스미는 것과 같은 모양입니다.
 *
 * 이 파일은 **숫자만** 냅니다 — 칸마다의 알파를 배열에 씁니다. 그리는 것은 `DiveCurtain` 입니다.
 *
 * 격자는 화면보다 훨씬 성깁니다(가로 240칸 남짓). 칠한 뒤 화면 크기로 늘리면 칸 사이가 부드럽게
 * 이어져 테가 저절로 흐려지고, 매 장 계산은 몇만 칸이라 3D 가 도는 동안에도 가볍습니다.
 */

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v)

const smoothstep = (a: number, b: number, x: number): number => {
  const t = clamp01((x - a) / (b - a))
  return t * t * (3 - 2 * t)
}

/**
 * 앞선이 얼마나 들쭉날쭉한가 — 가장 먼 모서리까지를 1 로 잰 거리에서 결이 앞뒤로 미는 폭입니다.
 * 올리면 갈래가 길게 뻗고, 0 이면 다시 원입니다.
 */
const RAGGED = 0.24

/** 앞선 **앞**의 옅은 테 — 젖기 시작한 자리가 번지는 폭 (거리 비) */
const FEATHER = 0.12

/** 앞선 **뒤**로 짙어지는 폭 — 스민 자리가 서서히 짙어지는 거리 (거리 비) */
const SOAK = 0.3

/** 막 스며든 자리의 짙기 — 여기서 시작해 `SOAK` 를 지나며 다 짙어집니다. 그동안 갑판이 비칩니다 */
const SOAK_FROM = 0.55

/**
 * 시작점 가까이에서는 **둥근 방울**입니다 — 결은 이 거리(거리 비)를 지나며 다 붙습니다.
 * 처음부터 결을 다 붙이면 시작점이 아니라 그 둘레의 결이 낮은 몇 자리에서 동시에 젖기 시작합니다.
 */
const ROUND_NEAR = 0.28

/** 짧은 변에 들어서는 큰 결의 수 — 화면에 갈래가 몇 줄기 서는가 */
const GRAIN_FEATURES = 3.2

/** 결을 비트는 세기 — 둥근 얼룩이 아니라 뻗는 갈래가 되게 합니다 */
const WARP = 1.6

/** 격자 한 점의 난수 0~1 — 같은 (x, y, seed) 면 늘 같은 값입니다 */
function hash(x: number, y: number, seed: number): number {
  let h =
    Math.imul(x, 374761393) ^
    Math.imul(y, 668265263) ^
    Math.imul(seed, 1274126177)
  h = Math.imul(h ^ (h >>> 13), 1103515245)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

/** 값 노이즈 — 격자 네 점 사이를 부드럽게 잇습니다 */
function valueNoise(x: number, y: number, seed: number): number {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const fx = x - xi
  const fy = y - yi
  const tx = fx * fx * (3 - 2 * fx)
  const ty = fy * fy * (3 - 2 * fy)
  const a = hash(xi, yi, seed)
  const b = hash(xi + 1, yi, seed)
  const c = hash(xi, yi + 1, seed)
  const d = hash(xi + 1, yi + 1, seed)
  return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty
}

/** 큰 결 위에 잔결을 겹칩니다 (fbm). 0~1 이지만 가운데로 몰립니다 */
function fbm(x: number, y: number, seed: number, octaves: number): number {
  let sum = 0
  let weight = 0.5
  let norm = 0
  let freq = 1
  for (let at = 0; at < octaves; at += 1) {
    sum += weight * valueNoise(x * freq, y * freq, seed + at * 131)
    norm += weight
    weight *= 0.5
    freq *= 2.03
  }
  return sum / norm
}

/**
 * 종이의 결 — 칸마다 0~1. 번짐 한 번에 한 번 만듭니다 (몇 ms 걸립니다 — 매 장 만들지 않습니다).
 *
 * NOTE: 0~1 을 **다 쓰도록 늘립니다.** fbm 은 값이 가운데로 몰려, 그대로 쓰면 앞선이 거의 안 흔들려
 *   다시 원이 됩니다.
 *
 * @param cols 가로 칸 수
 * @param rows 세로 칸 수
 * @param seed 결의 씨앗 — 같으면 같은 결입니다. 전환마다 바꾸면 번질 때마다 모양이 다릅니다
 * @returns 칸마다의 결 (행 우선)
 */
export function makeBleedGrain(
  cols: number,
  rows: number,
  seed: number,
): Float32Array {
  const grain = new Float32Array(cols * rows)
  const scale = GRAIN_FEATURES / Math.max(1, Math.min(cols, rows))
  let lo = Infinity
  let hi = -Infinity
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const u = col * scale
      const v = row * scale
      const wu = u + WARP * (fbm(u * 0.5, v * 0.5, seed + 7919, 2) - 0.5)
      const wv =
        v + WARP * (fbm(u * 0.5 + 7.3, v * 0.5 + 2.9, seed + 104729, 2) - 0.5)
      const n = fbm(wu, wv, seed, 4)
      grain[row * cols + col] = n
      if (n < lo) lo = n
      if (n > hi) hi = n
    }
  }
  const span = hi - lo || 1
  for (let at = 0; at < grain.length; at += 1) {
    grain[at] = ((grain[at] ?? lo) - lo) / span
  }
  return grain
}

/**
 * 칸마다 **언제 젖는가** — 시작점에서의 거리(가장 먼 모서리 = 1)를 결이 앞뒤로 민 값입니다.
 * 앞선이 이 값을 지나는 순간 그 칸이 젖기 시작합니다.
 *
 * NOTE: 시작점이 정해진 뒤 **한 번** 냅니다. 시작점은 번지는 동안 몇 px 도 안 움직이므로 매 장
 *   다시 내지 않습니다 — 매 장 하는 일은 `paintBleed` 의 비교뿐입니다.
 *
 * @param grain `makeBleedGrain` 의 결
 * @param cols 가로 칸 수
 * @param rows 세로 칸 수
 * @param origin 번짐이 시작하는 자리 — 화면 폭 · 높이에 대한 비율 (0~1)
 * @param aspect 화면의 가로 / 세로 — 거리를 둥글게 재는 데 씁니다
 * @returns 칸마다 젖는 때 (대략 0 ~ 1 + 들쭉날쭉한 폭)
 */
export function bleedReach(
  grain: Float32Array,
  cols: number,
  rows: number,
  origin: { x: number; y: number },
  aspect: number,
): Float32Array {
  const reach = new Float32Array(grain.length)
  const dx = origin.x * aspect
  const dy = origin.y
  const far = Math.hypot(Math.max(dx, aspect - dx), Math.max(dy, 1 - dy)) || 1
  for (let row = 0; row < rows; row += 1) {
    const y = (row + 0.5) / rows
    for (let col = 0; col < cols; col += 1) {
      const at = row * cols + col
      const x = ((col + 0.5) / cols) * aspect
      const d = Math.hypot(x - dx, y - dy) / far
      reach[at] =
        d + RAGGED * smoothstep(0, ROUND_NEAR, d) * ((grain[at] ?? 0.5) * 2 - 1)
    }
  }
  return reach
}

/**
 * 지금 번진 모양을 칸마다의 **알파**로 씁니다 (RGBA 의 A 만 — 색은 부르는 쪽이 한 번 채웁니다).
 *
 * 앞선이 시작점에서 가장 먼 결까지 **고른 걸음**으로 나아갑니다. 덮이는 넓이는 반지름의 제곱이라
 * 끝으로 갈수록 저절로 빨라집니다.
 * 앞선 앞은 옅게 번지고(`FEATHER`), 앞선 뒤는 반쯤 비치다가 서서히 짙어집니다(`SOAK`).
 *
 * @param reach `bleedReach` 의 젖는 때
 * @param rgba 그릴 칸 (길이 = 칸 수 × 4)
 * @param bleed 번진 정도 0~1 — 0 이면 아무 데도 안 젖었고, 1 이면 화면 전체가 다 짙습니다
 */
export function paintBleed(
  reach: Float32Array,
  rgba: Uint8ClampedArray,
  bleed: number,
): void {
  const front = -FEATHER + clamp01(bleed) * (1 + RAGGED + SOAK + FEATHER)
  for (let at = 0; at < reach.length; at += 1) {
    const v = reach[at] ?? 0
    const edge = 1 - smoothstep(front - FEATHER * 0.25, front + FEATHER, v)
    const soak = SOAK_FROM + (1 - SOAK_FROM) * smoothstep(0, SOAK, front - v)
    rgba[at * 4 + 3] = Math.round(255 * edge * soak)
  }
}
