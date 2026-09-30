import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router'

import { cn } from '@/shared/lib/cn'
import { useIsDiving } from '@/shared/store/diveStore'
import { FOCUS_RING } from '@/shared/ui/focusRing'

/** 팀이 만든 피드백 구글 폼(응답자 주소) */
const FEEDBACK_FORM_URL = 'https://forms.gle/mDvTFiY3H9Xew42K7'

/** 말풍선이 떠 있는 시간 */
const GREETING_MS = 4000

function PaperBoatIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="currentColor"
      className="size-10"
    >
      {/* 돛의 오른쪽 반을 옅게 칠해 접힌 종이의 그늘로 읽히게 합니다 */}
      <path d="M12 4.5L12 13.5H6.5Z" />
      <path d="M12 4.5L17.5 13.5H12Z" opacity="0.7" />
      <path d="M2.5 13.5H21.5L17.75 19H6.25Z" />
    </svg>
  )
}

/**
 * 화면 왼쪽 아래의 챗봇 모양 단추. 챗봇은 아니고, 누르면 피드백 폼이 새 탭에서 열립니다
 * — 보던 화면이 그대로 남아 폼을 쓰고 돌아오기 쉽습니다.
 * 화면을 옮길 때마다 옆에 '버튼을 눌러 피드백을 전해보세요!' 말풍선이 잠깐 떴다 사라집니다.
 *
 * NOTE: 색을 역할 토큰(`ink` · `surface`)이 아니라 팔레트 색으로 칠합니다 — 어두운 방
 * (`scent-display.css`)이 역할 토큰을 뒤집어 `ink` 가 흰색이 되면 흰 동그라미가 됩니다.
 * 어느 방에서든 검정 동그라미 · 흰 종이배여야 합니다.
 */
export function FeedbackButton() {
  const { t } = useTranslation('layout')
  const { pathname } = useLocation()
  const diving = useIsDiving()
  // 말풍선을 다 보여 준 화면. 주소가 바뀌면 이 값과 달라져 다시 뜹니다
  const [greetedPath, setGreetedPath] = useState<string | null>(null)
  // 잠수 커튼이 덮는 동안은 띄우지 않고, 걷힌 뒤부터 시간을 잽니다 — 커튼 밑에서 사라지면 못 봅니다
  const greeting = greetedPath !== pathname && !diving

  useEffect(() => {
    if (diving) return

    const timer = window.setTimeout(() => setGreetedPath(pathname), GREETING_MS)
    return () => window.clearTimeout(timer)
  }, [pathname, diving])

  return (
    <div className="fixed bottom-7.5 left-7.5 z-40">
      <a
        href={FEEDBACK_FORM_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={t('feedback.link')}
        className={cn(
          'flex size-20 items-center justify-center rounded-full',
          'bg-charcoal text-ivory shadow-overlay',
          'transition-transform duration-120 ease-out hover:scale-105 active:scale-95',
          FOCUS_RING,
        )}
      >
        <PaperBoatIcon />
      </a>

      {/*
        NOTE: 화면을 옮길 때마다 뜨는 말이라 스크린리더에는 읽히지 않게 합니다 — 읽히면
        화면 제목보다 이 말을 먼저 듣게 됩니다.
      */}
      <p
        aria-hidden
        className={cn(
          'pointer-events-none absolute top-1/2 left-full ml-5 -translate-y-1/2',
          'bg-ivory text-charcoal text-heading shadow-overlay rounded-full px-6 py-3.75 font-medium whitespace-nowrap',
          'transition-[opacity,translate,visibility] duration-200 ease-out motion-reduce:transition-none',
          'starting:-translate-x-1 starting:opacity-0',
          !greeting && 'invisible -translate-x-1 opacity-0',
        )}
      >
        {/* 단추 쪽을 가리키는 꼬리 */}
        <span className="bg-ivory absolute top-1/2 -left-1.5 size-3.75 -translate-y-1/2 rotate-45" />
        <span className="relative">{t('feedback.greeting')}</span>
      </p>
    </div>
  )
}
