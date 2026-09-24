import { create } from 'zustand'

interface CausticsState {
  /** 깔 물결 겹 수(0 ~ 2). null 이면 화면이 정하지 않은 것 — 두 겹 다 깝니다 */
  layers: number | null
  setLayers: (layers: number | null) => void
}

/**
 * 물결을 몇 겹 깔지. 물결을 그리는 것은 껍데기(RootLayout)이고 겹을 아는 것은 화면
 * (취향 테스트 — 고른 향 수)이라 둘 사이를 여기서 잇습니다. 화면을 떠날 때 null 로
 * 되돌려야 다른 화면이 두 겹을 그대로 받습니다.
 */
export const useCausticsStore = create<CausticsState>()((set) => ({
  layers: null,
  setLayers: (layers) => set({ layers }),
}))
