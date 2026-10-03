import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/** 그래픽 설정 — 사람이 고르는 값입니다. `auto` 면 엔진이 기기에 맞춰 단계를 고릅니다 */
export type GraphicsMode = 'auto' | 'high' | 'mid' | 'low' | 'min'

/** 엔진이 실제로 그리고 있는 단계 (엔진 `landing/src/quality.js` 의 `TIERS`) */
export type GraphicsTier = 'high' | 'mid' | 'low' | 'min'

/** 엔진이 GPU 이름으로 가른 부류 (엔진 `gpuClass`) */
export type GpuClass =
  'discrete' | 'integrated' | 'apple' | 'software' | 'unknown'

/**
 * 단계가 왜 지금 값이 되었는가.
 * `down` · `up` 은 엔진이 프레임 시간을 보고 스스로 옮긴 것이고, `slow` 는 가장 낮은 단계에서도
 * 느리다는 알림입니다 (단계는 그대로).
 */
export type QualityReason = 'start' | 'down' | 'up' | 'user' | 'slow'

export interface SceneQuality {
  mode: GraphicsMode
  tier: GraphicsTier
  reason: QualityReason
  gpuClass: GpuClass
}

/** 토스트로 알릴 것 (`features/map` 의 `qualityNotice`) */
export type QualityNotice = 'startLow' | 'down' | 'slow'

export const GRAPHICS_MODES: readonly GraphicsMode[] = [
  'auto',
  'high',
  'mid',
  'low',
  'min',
]

export const isGraphicsMode = (value: unknown): value is GraphicsMode =>
  typeof value === 'string' &&
  (GRAPHICS_MODES as readonly string[]).includes(value)

interface GraphicsState {
  /** 사람이 고른 그래픽 설정. 처음은 `auto` 입니다 */
  mode: GraphicsMode
  /** 이 기기에서 이미 알린 안내. 같은 안내를 두 번 띄우지 않습니다 */
  told: QualityNotice[]
  /** 엔진이 지금 그리는 단계 — 엔진이 붙기 전이거나 메인을 떠나 있으면 null. 남기지 않습니다 */
  quality: SceneQuality | null
  /**
   * **움직임 줄이기** (2026-10-01) — 켜면 3D 가 저절로 움직이는 몫(마우스 패럴랙스 · 돌고래 · 새 · 속도에 따른 카메라)을
   * 거둡니다. OS 의 '동작 줄이기' 와 같은 일을 이 사이트에서만 켭니다 (엔진 `PB.motion` · v0.85.0).
   */
  calm: boolean

  setMode: (mode: GraphicsMode) => void
  setCalm: (calm: boolean) => void
  markTold: (notice: QualityNotice) => void
  setQuality: (quality: SceneQuality | null) => void
}

/**
 * 메인 3D 의 그래픽 설정 (S15P21E203-435).
 *
 * 설정을 아는 것은 화면(HomePage — 엔진이 지금 단계를 알려 옵니다)이고 고르는 자리는 헤더의
 * 톱니바퀴(`GraphicsMenu`)라 둘 사이를 여기서 잇습니다 — `sceneSkyStore` 와 같은 사정입니다.
 *
 * `localStorage` 에 남기는 까닭: 기기의 성능은 방문마다 바뀌지 않습니다. 내장 그래픽 노트북에서
 * 낮음을 고른 사람에게 다음 방문에 다시 무거운 화면을 보이면 같은 선택을 또 하게 됩니다.
 *
 * NOTE: 자동일 때 **엔진이 고른 단계**는 여기에 남기지 않고 엔진이 GPU · 화면별로 따로 기억합니다
 * (`landing/src/quality.js` 의 `pb-quality`). 남기는 것은 사람이 고른 것뿐입니다.
 */
export const useGraphicsStore = create<GraphicsState>()(
  persist(
    (set) => ({
      mode: 'auto',
      told: [],
      quality: null,
      calm: false,

      setMode: (mode) => set({ mode }),
      setCalm: (calm) => set({ calm }),
      markTold: (notice) =>
        set((state) =>
          state.told.includes(notice)
            ? state
            : { told: [...state.told, notice] },
        ),
      setQuality: (quality) => set({ quality }),
    }),
    {
      name: 'hyanghae-graphics',
      version: 1,
      partialize: ({ mode, told, calm }) => ({ mode, told, calm }),
      // 손으로 고친 저장소 값이 모르는 모드면 자동으로 돌아갑니다
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<GraphicsState>
        return {
          ...current,
          mode: isGraphicsMode(saved.mode) ? saved.mode : current.mode,
          told: Array.isArray(saved.told) ? saved.told : current.told,
          // 예전 판(이 값이 없던 때)은 꺼진 채로 둡니다
          calm: saved.calm === true,
        }
      },
    },
  ),
)
