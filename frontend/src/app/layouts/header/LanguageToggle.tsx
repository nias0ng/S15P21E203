import { useTranslation } from 'react-i18next'

import { LOCALES } from '@/shared/i18n/locale'
import { cn } from '@/shared/lib/cn'
import { useLocale, useLocaleStore } from '@/shared/store/localeStore'

import { FOCUS, type Ink } from './tone'

// 단추에는 언어 이름을 그 언어의 약자로 적습니다 — 읽지 못하는 언어로 적힌 전환은 찾지 못합니다
const SHORT = { ko: 'KO', en: 'EN' } as const

/** 헤더의 화면 언어 전환 (KO · EN). 모든 화면에 섭니다 */
export function LanguageToggle({ ink }: { ink: Ink }) {
  const { t } = useTranslation()
  const locale = useLocale()
  const setLocale = useLocaleStore((state) => state.setLocale)

  return (
    <div
      role="group"
      aria-label={t('language.label')}
      className="text-caption flex items-center gap-1.25"
    >
      {LOCALES.map((option, index) => (
        <span key={option} className="flex items-center gap-1.25">
          {index > 0 && (
            <span aria-hidden className={cn(ink.text, 'opacity-40')}>
              ·
            </span>
          )}
          <button
            type="button"
            lang={option}
            aria-label={t(`language.${option}`)}
            aria-pressed={locale === option}
            onClick={() => setLocale(option)}
            className={cn(
              'tracking-[0.08em] transition-opacity duration-120 ease-out',
              ink.text,
              locale === option
                ? 'font-semibold'
                : 'opacity-55 hover:opacity-85',
              FOCUS,
              ink.ring,
            )}
          >
            {SHORT[option]}
          </button>
        </span>
      ))}
    </div>
  )
}
