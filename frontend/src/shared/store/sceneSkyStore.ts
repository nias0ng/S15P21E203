import { create } from 'zustand'

/** 3D 향 지도의 하늘 — 밝음(낮 · 저녁) · 어두움(밤) */
export type SceneSky = 'light' | 'dark'

interface SceneSkyState {
  sky: SceneSky
  setSky: (sky: SceneSky) => void
}

/**
 * 3D 향 지도의 하늘이 밝은지 어두운지. 하늘을 아는 것은 화면(HomePage)이고 헤더를
 * 그리는 것은 껍데기(RootLayout)라 둘 사이를 여기서 잇습니다.
 * 기본값은 dark — 3D 가 뜨기 전 자리가 남색 바탕입니다.
 */
export const useSceneSkyStore = create<SceneSkyState>()((set) => ({
  sky: 'dark',
  setSky: (sky) => set({ sky }),
}))
