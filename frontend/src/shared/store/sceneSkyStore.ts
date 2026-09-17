import { create } from 'zustand'

/** 3D 향 지도의 하늘 — 밝음(낮 · 저녁) · 어두움(밤) */
export type SceneSky = 'light' | 'dark'

interface SceneSkyState {
  sky: SceneSky
  setSky: (sky: SceneSky) => void
}

/**
 * 3D 향 지도의 하늘이 밝은지 어두운지 (전역 클라이언트 상태).
 *
 * 메인의 헤더는 3D 위에 거의 투명한 유리로 떠서, 글자색이 뒤의 하늘을 따라야 읽힙니다 —
 * 밝은 하늘에는 먹색, 밤하늘에는 상아색. 하늘을 아는 것은 화면(HomePage)이고 헤더를 그리는 것은
 * 껍데기(RootLayout)라, 둘 사이를 여기서 잇습니다.
 *
 * 기본값은 dark 입니다. 3D 가 뜨기 전 자리는 남색 바탕이라 상아색 글자여야 읽힙니다.
 */
export const useSceneSkyStore = create<SceneSkyState>()((set) => ({
  sky: 'dark',
  setSky: (sky) => set({ sky }),
}))
