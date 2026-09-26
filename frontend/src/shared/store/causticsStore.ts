import { create } from 'zustand'

interface CausticsState {
  layers: number | null
  setLayers: (layers: number | null) => void
}

export const useCausticsStore = create<CausticsState>()((set) => ({
  layers: null,
  setLayers: (layers) => set({ layers }),
}))
