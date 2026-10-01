import { create } from 'zustand'

interface SceneCardState {
  /** 3D 향 지도에 향수 카드가 떠 있는가 (엔진 `<html data-card>`) */
  open: boolean
  setOpen: (open: boolean) => void
}

/**
 * 3D 향 지도에 **향수 카드가 떠 있는지** (2026-10-01 · 메인 사용성 테스트 · 모바일).
 *
 * 좁은 화면에서는 3D 위에 얹은 앱 UI(향해 일지 · 의견 단추)가 카드 아랫단 — '이 향의 해역으로' 단추 — 를
 * 덮어 누를 수 없었습니다. 카드를 아는 것은 화면(HomePage — 엔진이 알려 옵니다)이고, 의견 단추는
 * 껍데기(RootLayout)에 있어 둘 사이를 여기서 잇습니다 (`sceneSkyStore` 와 같은 사정).
 * 메인을 떠나면 화면이 false 로 되돌립니다.
 */
export const useSceneCardStore = create<SceneCardState>()((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}))
