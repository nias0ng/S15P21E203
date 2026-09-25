type MapEntryLocationState = {
  tasteLanding?: boolean
}

export function tasteLandingState(): MapEntryLocationState {
  return { tasteLanding: true }
}

export function isTasteLanding(state: unknown): boolean {
  return ((state ?? {}) as MapEntryLocationState).tasteLanding === true
}
