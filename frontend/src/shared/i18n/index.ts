import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import { useLocaleStore } from '@/shared/store/localeStore'

import { EN_ERROR_MESSAGES } from './errorMessages'
import { DEFAULT_LOCALE, type Locale } from './locale'
import { en, ko, NAMESPACES } from './resources'

/**
 * 화면 언어를 켭니다. 번역 묶음은 앱에 같이 실려 첫 렌더부터 글자가 맞습니다 — 따로 받아 오면
 * 받는 동안 키가 화면에 비칩니다.
 *
 * 언어는 `localeStore` 가 쥐고 여기가 따릅니다. 바뀌면 `<html lang>` · 탭 제목 · 설명도 같이 바꿉니다.
 */
void i18n.use(initReactI18next).init({
  resources: { ko, en },
  lng: useLocaleStore.getState().locale,
  fallbackLng: DEFAULT_LOCALE,
  ns: NAMESPACES,
  defaultNS: 'common',
  interpolation: {
    // React 가 이미 글자를 이스케이프합니다
    escapeValue: false,
  },
  initAsync: false,
})

function applyToDocument(locale: Locale) {
  if (typeof document === 'undefined') return
  document.documentElement.lang = locale
  document.title = i18n.t('common:site.title')
  document
    .querySelector('meta[name="description"]')
    ?.setAttribute('content', i18n.t('common:site.description'))
}

applyToDocument(useLocaleStore.getState().locale)

useLocaleStore.subscribe((state, previous) => {
  if (state.locale === previous.locale) return
  void i18n.changeLanguage(state.locale).then(() => {
    applyToDocument(state.locale)
  })
})

/**
 * 서버 오류를 지금 화면 언어의 문구로 바꿉니다. 한국어는 서버 문구를 그대로 쓰고,
 * 영어는 코드별 표(`EN_ERROR_MESSAGES`)에서 고르며 표에 없으면 `fallback` 입니다.
 */
export function localizeServerError(
  code: string,
  serverMessage: string,
  fallback: string,
): string {
  if (i18n.language !== 'en') return serverMessage
  return EN_ERROR_MESSAGES[code] ?? fallback
}

export { i18n }
