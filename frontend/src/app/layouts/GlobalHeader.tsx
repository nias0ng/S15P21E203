import { cn } from '@/shared/lib/cn'
import { useAuthStore } from '@/shared/store/authStore'

import { AccountMenu } from './header/AccountMenu'
import { BrandMark } from './header/BrandMark'
import { LoginButton } from './header/LoginButton'
import { PrimaryNav } from './header/PrimaryNav'
import { GLASS, inkOf, isGlass, type HeaderTone } from './header/tone'

/**
 * 헤더 조각들은 `layouts/header/` 에 있습니다 (S15P21E203-397).
 *   tone            바탕별 글자 · 선 · 메뉴 색
 *   BrandMark       로고 — 메인으로 떠오르는 입구
 *   PrimaryNav      주요 메뉴 + 커뮤니티 펼침
 *   AccountMenu     계정 아이콘 ▾ / LoginButton  비로그인
 *   useDiveOut      메인에서 나가는 잠수 · useWarm  미리 받기 · useDismissable  드롭다운
 */
export type { HeaderTone }

/**
 * 전역 헤더 (N01 · 모든 화면 공통). 마이페이지 화면은 없습니다 — 개인 정보 수정은
 * 계정 아이콘에서 바로 들어갑니다. `grid-cols-[auto_1fr_auto]` 인 이유: flex +
 * ml-auto 면 로그인 여부로 오른쪽 폭이 바뀔 때 가운데 메뉴가 함께 움직입니다.
 */
export function GlobalHeader({ tone = 'surface' }: { tone?: HeaderTone }) {
  const accessToken = useAuthStore((state) => state.accessToken)
  const isLoggedIn = Boolean(accessToken)
  const onGlass = isGlass(tone)
  const ink = inkOf(tone)

  return (
    /*
     * ⚠ 폭은 **화면 폭(100vw)** 입니다 — 스크롤바를 뺀 폭이면 세로 스크롤이 있는
     * 화면에서 메뉴가 왼쪽으로 밀려 메인과 어긋납니다. 나간 15px 은 RootLayout 이
     * 잘라냅니다. ⚠⚠ `sm`(640) 부터입니다 — 더 좁으면 계정이 밖으로 나가고,
     * 잘라내면 아예 못 누릅니다.
     */
    <header
      className={cn(
        'top-0 z-20 sm:w-screen',
        ink.shadow,
        onGlass ? cn(GLASS, ink.tint) : 'sticky',
        tone === 'paper' && 'shelf-scope shelf-paper shelf-grain',
        tone === 'surface' && 'bg-surface',
      )}
    >
      <div className="max-w-frame mx-auto grid h-22.5 grid-cols-[auto_1fr_auto] items-center gap-5 px-[var(--gutter)]">
        <BrandMark ink={ink} />
        <PrimaryNav isLoggedIn={isLoggedIn} ink={ink} />

        {/*
          계정 (시안 우측 묶음). 구분선 · '오늘도, 좋은 향과 함께.' 문구는 2026-09-16 에,
          돋보기는 2026-09-21 에 뺐습니다 — 검색은 목록 화면 안에 있습니다(A33 · A34 · A35).
        */}
        <div className="flex shrink-0 items-center">
          {isLoggedIn ? <AccountMenu ink={ink} /> : <LoginButton ink={ink} />}
        </div>
      </div>
    </header>
  )
}
