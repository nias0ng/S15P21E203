import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface AuthUser {
  id: number
  nickname: string
  email: string
}

interface AuthState {
  accessToken: string | null
  user: AuthUser | null
  setAuth: (payload: { accessToken: string; user: AuthUser }) => void
  /**
   * 토큰만 갈아끼웁니다. 재발급과 로그인 첫 단계가 쓰는데,
   * 둘 다 사용자 정보를 아직 모르거나 바뀔 필요가 없는 자리입니다.
   */
  setAccessToken: (accessToken: string) => void
  clear: () => void
}

/**
 * 인증 상태 (전역 클라이언트 상태).
 * 서버에서 받아오는 데이터는 TanStack Query 로, 이런 세션성 상태만 Zustand 로 관리합니다.
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      user: null,
      setAuth: ({ accessToken, user }) => set({ accessToken, user }),
      setAccessToken: (accessToken) => set({ accessToken }),
      clear: () => set({ accessToken: null, user: null }),
    }),
    { name: 'hyanghae-auth' },
  ),
)

export const useIsLoggedIn = () => useAuthStore((state) => !!state.accessToken)
