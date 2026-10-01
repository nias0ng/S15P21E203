import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { detectLocale, isLocale, type Locale } from '@/shared/i18n/locale'

interface LocaleState {
  /** 화면 언어. 처음 온 사람은 브라우저 언어로 정해지고, 헤더에서 바꾸면 그 값이 남습니다 */
  locale: Locale
  setLocale: (locale: Locale) => void
}

function browserLanguages(): readonly string[] {
  if (typeof navigator === 'undefined') return []
  return navigator.languages.length > 0
    ? navigator.languages
    : [navigator.language]
}

/**
 * 화면 언어. 고르는 자리는 헤더(`LanguageToggle`)이고 따르는 쪽은 `shared/i18n` 입니다.
 *
 * 주소에 언어를 싣지 않고 브라우저에 남깁니다(설계 C 안) — 링크를 받은 사람은 자기 설정대로 봅니다.
 */
export const useLocaleStore = create<LocaleState>()(
  persist(
    (set) => ({
      locale: detectLocale(browserLanguages()),
      setLocale: (locale) => set({ locale }),
    }),
    {
      name: 'hyanghae-locale',
      version: 1,
      partialize: ({ locale }) => ({ locale }),
      // 손으로 고친 저장소 값이 모르는 언어면 처음 고른 값으로 돌아갑니다
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<LocaleState>
        return {
          ...current,
          locale: isLocale(saved.locale) ? saved.locale : current.locale,
        }
      },
    },
  ),
)

export const useLocale = () => useLocaleStore((state) => state.locale)
