/**
 * 메인(향 지도)에 **어떻게 들어왔는가**. 지금 가리는 것은 하나입니다 — 취향 테스트를 막
 * 마치고 왔는가.
 *
 * 왜 필요한가: 배를 놓을 자리는 서버의 **한 칸**(`exploration_state`)에서 옵니다. 취향 테스트가
 * 처음 한 번 그 칸에 좌표를 떨어뜨리고(`ExplorationService.placeStartingPoint`), 그 뒤로는
 * 메인을 떠날 때마다 마지막 항해 자리가 덮어씁니다. 그래서 **좌표만 봐서는 둘을 못 가릅니다.**
 * 착륙 구도와 해역 연출을 걸지 말지는 자리가 아니라 들어온 길이 정합니다.
 *
 * 넘기는 쪽(`TasteTestPage`)과 읽는 쪽(`HomePage`)이 서로 다른 도메인이라 `shared/config` 에
 * 둡니다 — 한쪽에 두면 나머지가 문자열을 손으로 적게 됩니다(`perfumeViewSource` 와 같은 까닭).
 *
 * 주소가 아니라 라우터 state 인 이유: **새로 고치면 사라지는 것이 맞습니다.** 새로 고친 사람은
 * 더 이상 취향 테스트에서 막 온 사람이 아니라 지도를 다시 연 사람입니다.
 */
type MapEntryLocationState = {
  tasteLanding?: boolean
}

/** `navigate(ROUTES.HOME, { state: tasteLandingState() })` */
export function tasteLandingState(): MapEntryLocationState {
  return { tasteLanding: true }
}

/**
 * 라우터 state 에서 읽어냅니다. 새로 고치거나 주소로 바로 들어오면 비어 있고 아무 값이나
 * 들어올 수 있어 `unknown` 에서 좁힙니다.
 */
export function isTasteLanding(state: unknown): boolean {
  return ((state ?? {}) as MapEntryLocationState).tasteLanding === true
}
