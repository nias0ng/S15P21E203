import { create } from 'zustand'

export type DiveStage = 'idle' | 'diving' | 'covered' | 'lifting'

export type DiveWay = 'dive' | 'rise' | 'cabin'

export interface CabinPoint {
  x: number
  y: number
}

interface DiveState {
  stage: DiveStage
  way: DiveWay
  to: string | null
  depth: number
  ready: boolean
  engine: ((k: number) => void) | null
  cabinEngine: ((k: number) => CabinPoint | null) | null

  setEngine: (dive: ((k: number) => void) | null) => void
  setCabinEngine: (cabin: ((k: number) => CabinPoint | null) | null) => void
  start: (to: string, way?: DiveWay, depth?: number) => void
  markCovered: () => void
  markReady: () => void
  lift: () => void
  end: () => void
}

export const useDiveStore = create<DiveState>()((set, get) => ({
  stage: 'idle',
  way: 'dive',
  to: null,
  depth: 0,
  ready: false,
  engine: null,
  cabinEngine: null,

  setEngine: (dive) => set({ engine: dive }),
  setCabinEngine: (cabin) => set({ cabinEngine: cabin }),

  start: (to, way = 'dive', depth = 0) => {
    if (get().stage !== 'idle') return
    set({ stage: 'diving', way, to, depth, ready: false })
  },
  markCovered: () => set({ stage: 'covered' }),
  markReady: () => set({ ready: true }),
  lift: () => set({ stage: 'lifting' }),
  end: () =>
    set({ stage: 'idle', way: 'dive', to: null, depth: 0, ready: false }),
}))

export const useIsDiving = () => useDiveStore((state) => state.stage !== 'idle')

export const useIsRising = () =>
  useDiveStore((state) => state.stage !== 'idle' && state.way === 'rise')
