import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

/** 아직 답하지 않은 설문 하나 */
interface PendingFeedback {
  /** 만족도를 보낼 때 쓰는 추천의 손잡이 */
  token: string
  /**
   * 그때 검색한 자연어 말. 설문에 같이 보여줍니다.
   *
   * NOTE: 손잡이만 들고 다니면 상세에 다녀와 받는 설문이 **무엇에 대한 답인지 화면에
   * 없습니다.** 결과 목록은 이미 닫혔고 검색창도 비어 있어, 그 사이에 향수 상세를 보고 온
   * 사람은 방금 무엇을 물었는지 기억에만 의존하게 됩니다.
   */
  query: string
}

interface PendingFeedbackState {
  /** 아직 답하지 않은 설문. `null` 이면 물을 것이 없습니다 */
  pending: PendingFeedback | null
  /** 답했거나 닫은 손잡이. 같은 추천을 다시 열어도 또 묻지 않습니다 */
  settled: string[]

  /** 추천 결과가 도착했습니다. 아직 답하지 않은 추천이면 설문을 걸어 둡니다 */
  hold: (pending: PendingFeedback) => void
  /** 답했거나 닫았습니다. 이 손잡이는 끝입니다 */
  settle: (token: string) => void
}

/**
 * 아직 답하지 않은 추천 만족도 설문 (NLR-08).
 *
 * 화면 상태가 아니라 **스토어**인 까닭: 결과에서 [자세히 보기]를 누르면 상세로 넘어가며
 * `HomePage` 가 통째로 언마운트됩니다. 설문을 `RecommendModal` 안에 들고 있으면 그 순간
 * 같이 사라져, 메인으로 돌아와도 물을 것이 남지 않습니다.
 *
 * `sessionStorage` 에 남기는 까닭: 상세 화면에서 새로고침하거나 그 주소를 그대로 다시 열면
 * 모듈 변수는 초기화됩니다. 탭을 닫으면 같이 사라지는 것이 맞습니다 — 며칠 뒤에 다시 와서
 * 그때의 추천이 어땠는지 묻는 것은 답을 못 받거나, 받아도 못 믿을 답입니다.
 *
 * NOTE: **설문을 닫는 길은 하나뿐입니다.** [건너뛰기] · [×] · Esc · 배경 어느 쪽으로 닫아도
 * 그 추천은 끝나고 다시 묻지 않습니다. 한때 [×] 는 접어 두기만 해서 메인으로 돌아올 때 다시
 * 물었는데, 화면에서는 두 단추가 나란히 있을 뿐 어느 쪽이 영영 끝인지 알 길이 없어
 * **답하지 않기로 한 사람에게 같은 설문이 새로고침마다 다시 떴습니다.**
 *
 * NOTE: `shared/store/` 가 아니라 도메인 안입니다. 꽂는 곳(`RecommendModal`)과 읽는 곳
 * (`HomePage` 의 `NlrFeedbackModal`)이 추천 도메인과 그것을 조합하는 화면뿐입니다.
 */
export const usePendingFeedbackStore = create<PendingFeedbackState>()(
  persist(
    (set, get) => ({
      pending: null,
      settled: [],

      hold: (pending) => {
        if (get().settled.includes(pending.token)) return
        set({ pending })
      },
      settle: (token) =>
        set((state) => ({
          pending: null,
          // 한 세션에 스무 번이면 충분합니다 — 손잡이를 끝없이 쌓을 자리가 아닙니다
          settled: [...state.settled, token].slice(-20),
        })),
    }),
    {
      name: 'hyanghae-nlr-feedback',
      storage: createJSONStorage(() => sessionStorage),
      // 손잡이만 담던 시절의 값이 남아 있으면 검색어 없이 뜹니다 — 그 판은 버립니다
      version: 1,
      migrate: () => ({ pending: null, settled: [] }),
      // 담는 것을 적어 둡니다 — 나중에 화면용 값이 늘어도 저장까지 따라가지 않게
      partialize: ({ pending, settled }) => ({ pending, settled }),
    },
  ),
)
