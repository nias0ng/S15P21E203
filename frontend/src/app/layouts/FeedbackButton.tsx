import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router'

import { ROUTES } from '@/shared/config/routes'
import { cn } from '@/shared/lib/cn'
import { useIsDiving } from '@/shared/store/diveStore'
import { FOCUS_RING } from '@/shared/ui/focusRing'

/** 팀이 만든 피드백 구글 폼(응답자 주소) */
const FEEDBACK_FORM_URL = 'https://forms.gle/mDvTFiY3H9Xew42K7'

/** 말풍선이 떠 있는 시간 */
const GREETING_MS = 4000

/** 이 탭에서 말풍선을 한 번 보여 줬다는 표시 (`sessionStorage`) */
const GREETED_KEY = 'hyanghae-feedback-greeted'

const readGreeted = () => {
  try {
    return sessionStorage.getItem(GREETED_KEY) === '1'
  } catch {
    return false
  }
}

const writeGreeted = () => {
  try {
    sessionStorage.setItem(GREETED_KEY, '1')
  } catch {
    // 저장소를 못 쓰는 창이면 이 화면에서만 기억합니다 — 그래도 화면마다 다시 뜨지는 않습니다
  }
}

/**
 * 말풍선 아이콘 — 누르면 **의견을 남긴다** 는 것만 말합니다.
 *
 * 예전에는 종이배였습니다. 3D 바다 위에 배가 떠 있는 메인에서는 배 아이콘이 '항해' · '내 배' 단추로
 * 읽혀, 사용성 테스트 7명이 모두 누르기 전까지 피드백 단추인 줄 몰랐습니다(2026-10-01).
 */
function FeedbackIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="size-[45%]">
      <path
        className="fill-ivory"
        d="M12 3.5c-5 0-9 3.3-9 7.5 0 2.3 1.2 4.3 3.1 5.7L5.4 20a.6.6 0 0 0 .8.7l4-1.9c.6.1 1.2.2 1.8.2 5 0 9-3.4 9-7.5S17 3.5 12 3.5Z"
      />
      <circle cx="8" cy="11" r="1.1" className="fill-charcoal" />
      <circle cx="12" cy="11" r="1.1" className="fill-charcoal" />
      <circle cx="16" cy="11" r="1.1" className="fill-charcoal" />
    </svg>
  )
}

/**
 * 화면 왼쪽 아래의 의견 단추. 누르면 피드백 폼이 새 탭에서 열립니다 — 보던 화면이 그대로 남아
 * 폼을 쓰고 돌아오기 쉽습니다.
 *
 * ⭐ 2026-10-01 (메인 사용성 테스트 · 7명 모두 짚음) :
 *   - 말풍선은 **탭마다 한 번만** 혼자 띄웁니다. 예전에는 화면을 옮길 때마다 4초씩 떠 보던 글을 덮었습니다.
 *     그 뒤로는 손을 올리거나(호버) 초점이 오면 같은 말이 뜹니다 — 무엇인지 알고 싶을 때만 말합니다.
 *   - **메인(3D)에서는 작게** 섭니다. 그 자리는 해역에 들어설 때 엔진이 '01 … ZONE / FIND YOUR SCENT'
 *     를 쓰는 곳이라(`landing/index.html` 의 `#zone-mark` · 왼쪽 56 · 아래 76), 큰 동그라미가 그 글을
 *     가렸습니다. 작은 동그라미(48)는 그 글자보다 왼쪽 아래에 머뭅니다.
 *
 * NOTE: 색을 역할 토큰(`ink` · `surface`)이 아니라 팔레트 색으로 칠합니다 — 어두운 방
 * (`scent-display.css`)이 역할 토큰을 뒤집어 `ink` 가 흰색이 되면 흰 동그라미가 됩니다.
 * 어느 방에서든 검정 동그라미 · 흰 말풍선이어야 합니다.
 */
export function FeedbackButton() {
  const { t } = useTranslation('layout')
  const { pathname } = useLocation()
  const diving = useIsDiving()
  const onScene = pathname === ROUTES.HOME
  // 이 탭에서 처음 한 번만 혼자 뜹니다 (위 머리말)
  const [greeted, setGreeted] = useState(readGreeted)
  // 잠수 커튼이 덮는 동안은 띄우지 않고, 걷힌 뒤부터 시간을 잽니다 — 커튼 밑에서 사라지면 못 봅니다
  const greeting = !greeted && !diving

  useEffect(() => {
    if (greeted || diving) return

    const timer = window.setTimeout(() => {
      writeGreeted()
      setGreeted(true)
    }, GREETING_MS)
    return () => window.clearTimeout(timer)
  }, [greeted, diving])

  return (
    <div
      className={cn(
        'group fixed z-40',
        onScene ? 'bottom-5 left-5' : 'bottom-7.5 left-7.5',
      )}
    >
      <a
        href={FEEDBACK_FORM_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={t('feedback.link')}
        className={cn(
          'flex items-center justify-center rounded-full',
          onScene ? 'size-12' : 'size-20',
          'bg-charcoal shadow-overlay',
          'transition-transform duration-120 ease-out hover:scale-105 active:scale-95',
          FOCUS_RING,
        )}
      >
        <FeedbackIcon />
      </a>

      {/*
        NOTE: 화면에 저절로 뜨는 말이라 스크린리더에는 읽히지 않게 합니다 — 읽히면 화면 제목보다
        이 말을 먼저 듣게 됩니다. 단추의 이름(aria-label)이 같은 뜻을 이미 말합니다.
      */}
      <p
        aria-hidden
        className={cn(
          'pointer-events-none absolute top-1/2 left-full ml-3.75 -translate-y-1/2',
          'bg-ivory text-charcoal shadow-overlay rounded-full px-5 py-3 font-medium whitespace-nowrap',
          onScene ? 'text-body' : 'text-heading',
          'transition-[opacity,translate,visibility] duration-200 ease-out motion-reduce:transition-none',
          'starting:-translate-x-1 starting:opacity-0',
          !greeting &&
            'invisible -translate-x-1 opacity-0 group-focus-within:visible group-focus-within:translate-x-0 group-focus-within:opacity-100 group-hover:visible group-hover:translate-x-0 group-hover:opacity-100',
        )}
      >
        {/* 단추 쪽을 가리키는 꼬리 */}
        <span className="bg-ivory absolute top-1/2 -left-1.5 size-3.75 -translate-y-1/2 rotate-45" />
        <span className="relative">{t('feedback.greeting')}</span>
      </p>
    </div>
  )
}
