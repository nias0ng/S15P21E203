/**
 * 3D 향 지도 로딩 커튼의 **부팅 상태 모델** — 순수 함수입니다 (React 를 모릅니다).
 *
 * 엔진(`landing/src/host.js` 의 `bootReport`)이 부팅 단계를 postMessage 로 알리고, 앱은 그것을 모아
 * **언제 커튼을 걷어도 되는지**(`isBootFinishing`)만 판정합니다.
 *
 * ⚠️ 2026-09-18 에 **퍼센트 계산을 통째로 지웠습니다** (사용자 : *"원래 있던거 다 지우고 그냥 구름
 * 걷힌다는거임"*). 진행률 곡선 · 페이스 상한 · 기어가기(creep) · 단계 가중치와 `bootCounter.ts` ·
 * `bootWordmark.ts` 가 그때 같이 없어졌습니다 — 커튼에 숫자가 없으니 따라갈 목표도 없습니다.
 * 되살릴 일이 생기면 커밋 `05b7de7` 에 그대로 있습니다.
 */

type SceneBootStage =
  'html' | 'script' | 'frame' | 'boat-bytes' | 'boat' | 'error'

/**
 * 엔진이 보내는 신호 한 개 (`{ type: 'pb:boot', stage, … }` 에서 type 을 뺀 것).
 * 받은 바이트 · 배를 붙였는지 같은 나머지 칸은 걷는 때를 정하지 않아 받지 않습니다.
 */
export interface SceneBootEvent {
  stage: SceneBootStage
  /** error */
  where?: string
  message?: string
}

/** 늦게 붙은 앱이 놓친 단계를 따라잡는 스냅샷 (`window.PB.boot()` · host.js `bootNow`) — 여기서 읽는 것만 */
export interface SceneBootSnapshot {
  stages: Record<string, number>
  error: { where: string; message: string } | null
}

/** 끝났는지를 보는 단계 — 이 순서로 옵니다. 뒤 단계가 오면 앞 단계도 끝난 것입니다 */
const DONE_STAGES = ['html', 'script', 'frame', 'boat'] as const
type DoneStage = (typeof DONE_STAGES)[number]

export interface SceneBootState {
  /**
   * **엔진을 기다리기 시작한 때** (performance.now 기준) — 첫 장 상한(`BOOT_FRAME_TIMEOUT_MS`)을
   * 여기서 셉니다.
   *
   * ⚠⚠ 커튼 시계와 나눠 두는 까닭 : 첫 진입의 커튼 시계는 0(항해 시작 — index.html 의 정적
   * 커튼이 그때부터 보였습니다)인데, 엔진은 그때
   * 뜨기 시작하는 것이 아니라 **앱 번들이 다 와서 `ScentScene` 이 마운트된 뒤에야** iframe 에
   * 주소가 붙습니다. 상한을 0 부터 세면 번들 받는 시간이 엔진 예산에서 그대로 까이고, 회선이
   * 나쁜 첫 접속에서는 **엔진이 아직 오는 중인데 커튼이 걷혀** 남색 바탕에 앱 UI 만 선 화면이
   * 드러납니다 (2026-09-23 사용자 : *"이미 UI가 다 보이는 상태로 파란색 화면에서 로딩을 시작함"* ·
   * 첫 장을 막고 재어 보면 정확히 20.2초에 걷힙니다).
   *
   * ⚠ 최소 표시 시간(`minUntil`)은 그대로 커튼 시계에서 나옵니다 — 그쪽은 "커튼이 언제부터
   *   보였나" 라서 항해 시작(0)이 맞습니다. 두 시계는 뜻이 다릅니다.
   */
  watchedAt: number
  /** 이 시각 전에는 100% 가 되지 않습니다 */
  minUntil: number
  /** 단계가 끝난 시각 */
  doneAt: Partial<Record<DoneStage, number>>
  error: string | null
}

/**
 * 첫 진입 — 항해 시작부터 이만큼은 보여 줍니다.
 *
 * 3초(사용자 "로딩시간 3초 정도") → 4.2초(*"로딩을 좀 길게"*) → **1.5초** (2026-09-18 사용자 :
 * *"그냥 약간 아이보리 화면에서 가운데서 구름 걷히듯이 하는 효과만 간단하게 넣자 1초 정도만"* ·
 * 확인 : *"1~2초로 하고"*). 향 원 세 개 · 붓글씨 '향해' · 퍼센트를 전부 빼고 구름 걷힘만 남겼습니다.
 *
 * ⚠️ **이 값은 바닥일 뿐입니다** — 커튼은 `isBootFinishing`(다 떴고 + 이 시간이 지났음)에 걷힙니다.
 * 엔진이 GLB(8MB)와 셰이더 컴파일로 메인 스레드를 1~3초 막으므로 **실제로는 그보다 늦게 걷힙니다.**
 * 1.5초로 내려도 바다가 1.5초에 나오는 것이 아니라, 준비되는 즉시 나옵니다(예전에는 4.2초까지 붙잡고 있었습니다).
 */
export const BOOT_FIRST_MIN_MS = 1500
/** 첫 진입이라도 React 가 뜬 뒤 이만큼은 보여 줍니다 — 번들이 늦게 와도 구름이 갈라지는 것은 보이게 */
export const BOOT_MOUNT_FLOOR_MS = 700
/** 앱 안에서 메인으로 돌아왔을 때 — 엔진은 처음부터 다시 뜨지만 캐시가 차 있어 짧게 */
export const BOOT_REVISIT_MIN_MS = 900
/**
 * 첫 장(frame)이 이만큼 안 오면 걷습니다 — 3D 가 없어도 화면은 보여야 합니다.
 *
 * ⚠⚠ 세는 기준은 **엔진을 기다리기 시작한 때**(`watchedAt`)입니다. 항해 시작(0)부터 세면
 *   번들 받는 시간이 엔진 예산에서 까입니다 — `watchedAt` 머리말.
 */
export const BOOT_FRAME_TIMEOUT_MS = 20000
/** 첫 장 뒤 배 GLB 가 이만큼 안 오면 종이배 그대로 걷습니다 */
export const BOOT_BOAT_TIMEOUT_MS = 12000
export function createBootState(
  now: number,
  firstVisit: boolean,
): SceneBootState {
  return {
    // 엔진은 첫 진입이든 아니든 **지금부터** 뜹니다 (위 watchedAt 머리말)
    watchedAt: now,
    minUntil: firstVisit
      ? Math.max(BOOT_FIRST_MIN_MS, now + BOOT_MOUNT_FLOOR_MS)
      : now + BOOT_REVISIT_MIN_MS,
    doneAt: {},
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

/** 걷어도 되는가 — 배까지 붙었거나, 오류거나, 기다릴 만큼 기다렸거나 */
export function isBootReady(state: SceneBootState, now: number): boolean {
  if (state.doneAt.boat !== undefined || state.error !== null) return true
  if (state.doneAt.frame !== undefined) {
    return now - state.doneAt.frame >= BOOT_BOAT_TIMEOUT_MS
  }
  return now - state.watchedAt >= BOOT_FRAME_TIMEOUT_MS
}

/** 다 떴고 최소 표시 시간도 지났는가 — 숫자가 100 으로 가도 됩니다 */
export function isBootFinishing(state: SceneBootState, now: number): boolean {
  return isBootReady(state, now) && now >= state.minUntil
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
const stringOr = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined

/** 엔진의 postMessage 데이터 → 신호. 모양이 다르면(다른 메시지) null */
export function parseBootMessage(data: unknown): SceneBootEvent | null {
  if (typeof data !== 'object' || data === null) return null
  const record = data as Record<string, unknown>
  if (record.type !== 'pb:boot' || !isStage(record.stage)) return null
  return {
    stage: record.stage,
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
  if (snapshot.error) {
    events.push({
      stage: 'error',
      where: snapshot.error.where,
      message: snapshot.error.message,
    })
  }
  return events
}
