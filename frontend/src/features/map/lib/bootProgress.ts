/**
 * 3D 향 지도 로딩 커튼의 진행률 모델 — 순수 함수입니다 (React 를 모릅니다).
 *
 * 엔진(`landing/src/host.js` 의 `bootReport`)이 부팅 단계를 postMessage 로 알리고, 앱은
 * 단계마다 가중치를 곱해 더합니다. 아직 안 끝난 단계는 시간으로 조금씩 기어갑니다(creep) —
 * 신호가 오기 전에 숫자가 서 있으면 끊긴 것으로 보입니다.
 *
 * 숫자가 따라갈 목표값은 **페이스 곡선과 "실제 진행 + 조금" 중 작은 값**입니다. 페이스 곡선은 최소
 * 표시 시간(첫 진입 5초)에 걸쳐 99 까지 오르는 곡선이라, 다 받았어도 향이 퍼지듯 차오르고,
 * 덜 받았으면 받은 만큼보다 조금(BOOT_LEAD)만 앞서 갑니다 — 딱 맞추지 않고 느슨하게 따라갑니다.
 * 숫자가 목표를 어떻게 따라가는지(멈추지 않기 · 굴러가기)는 `bootCounter.ts` 입니다.
 *
 * 설계 근거: landing/docs/고도화-0917/03-로딩-전환-수중.md §2-3 · §2-5.
 */

export type SceneBootStage =
  'html' | 'script' | 'frame' | 'boat-bytes' | 'boat' | 'error'

/** 엔진이 보내는 신호 한 개 (`{ type: 'pb:boot', stage, … }` 에서 type 을 뺀 것) */
export interface SceneBootEvent {
  stage: SceneBootStage
  /** boat-bytes — 받은 바이트 · 전체 (0 이면 크기를 모릅니다) */
  loaded?: number
  total?: number
  /** boat — GLB 를 붙였는지(false 면 종이배로 갑니다) · 종이배 설정이라 건너뛰었는지 */
  ok?: boolean
  skipped?: boolean
  /** error */
  where?: string
  message?: string
}

/** 늦게 붙은 앱이 놓친 단계를 따라잡는 스냅샷 (`window.PB.boot()` · host.js `bootNow`) */
export interface SceneBootSnapshot {
  stages: Record<string, number>
  bytes: { loaded: number; total: number } | null
  error: { where: string; message: string } | null
}

/** 끝났는지를 보는 단계 — 이 순서로 옵니다. 뒤 단계가 오면 앞 단계도 끝난 것입니다 */
const DONE_STAGES = ['html', 'script', 'frame', 'boat'] as const
type DoneStage = (typeof DONE_STAGES)[number]

export interface SceneBootState {
  /** 첫 진입인가 — index.html 의 정적 커튼(#boot)이 서 있었습니다. 다시 들어오면 원이 두 배 빠르게 번집니다 */
  firstVisit: boolean
  /**
   * 커튼 시계의 0 (performance.now 기준). 첫 진입은 항해 시작(0) — index.html 의 정적
   * 커튼이 그때부터 보였으므로 그 시간도 로딩 시간에 셉니다
   */
  startedAt: number
  /** 이 시각 전에는 100% 가 되지 않습니다 */
  minUntil: number
  /** 단계가 끝난 시각 */
  doneAt: Partial<Record<DoneStage, number>>
  boatLoaded: number
  /** null 이면 크기를 모릅니다 (서버가 Content-Length 를 안 줬거나 아직 진행 신호가 없음) */
  boatTotal: number | null
  error: string | null
}

/**
 * 첫 진입 — 항해 시작부터 이만큼은 보여 줍니다.
 * 처음엔 3초였고(사용자 "로딩시간 3초 정도"), 2026-09-18 사용자 *"로딩을 좀 길게 해보자"* 로 5초.
 * 글자 그리기(SceneBootCurtain 의 WORD_*)와 원의 템포(scene-boot.css 의 --boot-tempo)도 같이 늘렸습니다.
 */
export const BOOT_FIRST_MIN_MS = 4200
/** 첫 진입이라도 React 가 뜬 뒤 이만큼은 보여 줍니다 — 번들이 늦게 와도 원이 퍼지는 것은 보이게 */
export const BOOT_MOUNT_FLOOR_MS = 1800
/** 앱 안에서 메인으로 돌아왔을 때 — 엔진은 처음부터 다시 뜨지만 캐시가 차 있어 짧게 */
export const BOOT_REVISIT_MIN_MS = 2200
/** 첫 장(frame)이 이만큼 안 오면 걷습니다 — 3D 가 없어도 화면은 보여야 합니다 */
export const BOOT_FRAME_TIMEOUT_MS = 20000
/** 첫 장 뒤 배 GLB 가 이만큼 안 오면 종이배 그대로 걷습니다 */
export const BOOT_BOAT_TIMEOUT_MS = 12000
/** 다 뜨기 전 표시 상한 — 100 은 "다 왔다" 일 때만 */
export const BOOT_CEILING = 99
/**
 * 숫자는 실제 진행보다 이만큼(퍼센트 포인트) 앞서 갈 수 있습니다. 사용자 (2026-09-17) :
 * "퍼센트도 완전히 일치보단 느슨하게" — 받은 만큼에 딱 붙으면 신호 사이마다 숫자가 섭니다
 */
export const BOOT_LEAD = 12

/** 단계 가중치 — 합 100. "보통 회선에서 그 단계가 차지하는 시간" 을 어림한 값이라 GLB 를 압축하면 다시 잡습니다 */
const WEIGHT = { html: 5, script: 15, frame: 25, boatBytes: 45, boat: 10 }
/** 기어가기 시간 상수 — 단계 시작 뒤 이만큼에 90% 의 63% 에 닿습니다 */
const TAU_MS = { html: 400, script: 800, frame: 600, boatBytes: 2500 }

export function createBootState(
  now: number,
  firstVisit: boolean,
): SceneBootState {
  return {
    firstVisit,
    startedAt: firstVisit ? 0 : now,
    minUntil: firstVisit
      ? Math.max(BOOT_FIRST_MIN_MS, now + BOOT_MOUNT_FLOOR_MS)
      : now + BOOT_REVISIT_MIN_MS,
    doneAt: {},
    boatLoaded: 0,
    boatTotal: null,
    error: null,
  }
}

const isDoneStage = (stage: SceneBootStage): stage is DoneStage =>
  (DONE_STAGES as readonly string[]).includes(stage)

/** 신호 하나를 반영합니다. 바뀌는 것이 없으면 같은 객체를 돌려줍니다 */
export function applyBootEvent(
  state: SceneBootState,
  event: SceneBootEvent,
  now: number,
): SceneBootState {
  if (event.stage === 'boat-bytes') {
    const total =
      event.total !== undefined && event.total > 0 ? event.total : null
    return {
      ...state,
      // 받은 양은 줄지 않습니다 — 순서가 어긋난 신호로 숫자가 뒤로 가지 않게
      boatLoaded: Math.max(state.boatLoaded, event.loaded ?? 0),
      boatTotal: total ?? state.boatTotal,
    }
  }
  if (event.stage === 'error') {
    return { ...state, error: event.message || event.where || 'error' }
  }
  if (!isDoneStage(event.stage) || state.doneAt[event.stage] !== undefined) {
    return state
  }
  // 뒤 단계가 왔으면 앞 단계도 끝난 것입니다 — 놓친 신호 때문에 기어가기가 영영 남지 않게
  const doneAt = { ...state.doneAt }
  for (const stage of DONE_STAGES) {
    doneAt[stage] ??= now
    if (stage === event.stage) break
  }
  return { ...state, doneAt }
}

/** 단계 시작 뒤 흐른 시간으로 0 → 0.9 에 다가갑니다. 1 은 신호가 왔을 때만 */
const creep = (elapsedMs: number, tauMs: number): number =>
  elapsedMs <= 0 ? 0 : 0.9 * (1 - Math.exp(-elapsedMs / tauMs))

/** 실제 진행 0~100 — 끝난 단계는 가중치 전부, 아닌 단계는 앞 단계가 끝난 뒤부터 기어갑니다 */
export function bootTarget(state: SceneBootState, now: number): number {
  const { doneAt, startedAt } = state
  const html =
    doneAt.html !== undefined ? 1 : creep(now - startedAt, TAU_MS.html)
  const script =
    doneAt.script !== undefined
      ? 1
      : creep(now - (doneAt.html ?? startedAt), TAU_MS.script)
  const frame =
    doneAt.frame !== undefined
      ? 1
      : creep(now - (doneAt.script ?? startedAt), TAU_MS.frame)
  let bytes: number
  if (doneAt.boat !== undefined) {
    bytes = 1
  } else if (state.boatTotal !== null) {
    bytes = Math.min(1, state.boatLoaded / state.boatTotal)
  } else {
    bytes = creep(now - (doneAt.frame ?? startedAt), TAU_MS.boatBytes)
  }
  const boat = doneAt.boat !== undefined ? 1 : 0
  return (
    WEIGHT.html * html +
    WEIGHT.script * script +
    WEIGHT.frame * frame +
    WEIGHT.boatBytes * bytes +
    WEIGHT.boat * boat
  )
}

/**
 * 향이 퍼지듯 처음에 빠르고 끝으로 갈수록 느려지되, 끝에서도 서지 않습니다 — outQuad 에 직선을 30% 섞었습니다.
 * (예전 outCubic 은 끝의 기울기가 0 이라 90 뒤로 숫자가 거의 멈춰 보였습니다)
 */
const ease = (t: number): number => 0.3 * t + 0.7 * (1 - (1 - t) ** 2)

/** 페이스 상한 — 최소 표시 시간에 걸쳐 0 → 99 */
export function bootCeiling(state: SceneBootState, now: number): number {
  const span = state.minUntil - state.startedAt
  if (span <= 0) return BOOT_CEILING
  const t = Math.min(1, Math.max(0, (now - state.startedAt) / span))
  return BOOT_CEILING * ease(t)
}

/** 걷어도 되는가 — 배까지 붙었거나, 오류거나, 기다릴 만큼 기다렸거나 */
export function isBootReady(state: SceneBootState, now: number): boolean {
  if (state.doneAt.boat !== undefined || state.error !== null) return true
  if (state.doneAt.frame !== undefined) {
    return now - state.doneAt.frame >= BOOT_BOAT_TIMEOUT_MS
  }
  return now - state.startedAt >= BOOT_FRAME_TIMEOUT_MS
}

/** 다 떴고 최소 표시 시간도 지났는가 — 숫자가 100 으로 가도 됩니다 */
export function isBootFinishing(state: SceneBootState, now: number): boolean {
  return isBootReady(state, now) && now >= state.minUntil
}

/**
 * 숫자가 따라갈 목표 — 페이스 상한과 (실제 진행 + BOOT_LEAD) 중 작은 값이고 99 를 넘지 않습니다.
 * 다 떴고 최소 시간도 지났으면 100
 */
export function bootDisplayTarget(state: SceneBootState, now: number): number {
  if (isBootFinishing(state, now)) return 100
  return Math.min(
    BOOT_CEILING,
    bootCeiling(state, now),
    bootTarget(state, now) + BOOT_LEAD,
  )
}

const STAGES: readonly SceneBootStage[] = [
  'html',
  'script',
  'frame',
  'boat-bytes',
  'boat',
  'error',
]
const isStage = (value: unknown): value is SceneBootStage =>
  typeof value === 'string' && (STAGES as readonly string[]).includes(value)
const numberOr = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined
const stringOr = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined
const booleanOr = (value: unknown): boolean | undefined =>
  typeof value === 'boolean' ? value : undefined

/** 엔진의 postMessage 데이터 → 신호. 모양이 다르면(다른 메시지) null */
export function parseBootMessage(data: unknown): SceneBootEvent | null {
  if (typeof data !== 'object' || data === null) return null
  const record = data as Record<string, unknown>
  if (record.type !== 'pb:boot' || !isStage(record.stage)) return null
  return {
    stage: record.stage,
    loaded: numberOr(record.loaded),
    total: numberOr(record.total),
    ok: booleanOr(record.ok),
    skipped: booleanOr(record.skipped),
    where: stringOr(record.where),
    message: stringOr(record.message),
  }
}

/** `window.PB.boot()` 스냅샷 → 놓친 신호 목록 (순서대로) */
export function snapshotEvents(snapshot: SceneBootSnapshot): SceneBootEvent[] {
  const events: SceneBootEvent[] = []
  for (const stage of DONE_STAGES) {
    if (snapshot.stages[stage] !== undefined) events.push({ stage })
  }
  if (snapshot.bytes) {
    events.push({
      stage: 'boat-bytes',
      loaded: snapshot.bytes.loaded,
      total: snapshot.bytes.total,
    })
  }
  if (snapshot.error) {
    events.push({
      stage: 'error',
      where: snapshot.error.where,
      message: snapshot.error.message,
    })
  }
  return events
}
