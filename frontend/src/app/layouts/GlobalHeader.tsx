import { cn } from '@/shared/lib/cn'
import { useAuthStore } from '@/shared/store/authStore'

import { AccountMenu } from './header/AccountMenu'
import { BrandMark } from './header/BrandMark'
import { LoginButton } from './header/LoginButton'
import { PrimaryNav } from './header/PrimaryNav'
import { GLASS, inkOf, isGlass, type HeaderTone } from './header/tone'

export type { HeaderTone }

/**
 * 전역 헤더 (N01 · 모든 화면 공통). 마이페이지 화면은 없습니다 — 개인 정보 수정은
 * 계정 아이콘에서 바로 들어갑니다.
 *
 * NOTE: 가운데 칸이 grid 인 이유 — flex + ml-auto 면 로그인 여부로 오른쪽 폭이 바뀔 때
 * 가운데 메뉴가 함께 움직입니다.
 */
export function GlobalHeader({ tone = 'surface' }: { tone?: HeaderTone }) {
  const accessToken = useAuthStore((state) => state.accessToken)
  const isLoggedIn = Boolean(accessToken)
  const onGlass = isGlass(tone)
  const ink = inkOf(tone)

  return (
    /*
     * NOTE: 폭은 화면 폭(100vw)이고 `sm`(640) 부터입니다. 스크롤바를 뺀 폭이면 세로
     * 스크롤이 있는 화면에서 메뉴가 메인과 어긋나고, 더 좁으면 계정이 밖으로 나갑니다.
     */
    <header
      className={cn(
        'top-0 z-20 sm:w-screen',
        ink.shadow,
        onGlass ? cn(GLASS, ink.tint) : 'sticky',
        tone === 'paper' && 'shelf-scope shelf-paper shelf-grain',
        tone === 'surface' && 'bg-surface',
        /* 어두운 방은 방과 같은 그림을 나눠 그립니다 — 단색을 두면 위쪽에 띠가 집니다 */
        tone === 'night' && 'scent-night-header',
      )}
    >
      <div className="max-w-frame mx-auto grid h-22.5 grid-cols-[auto_1fr_auto] items-center gap-5 px-[var(--gutter)]">
        <BrandMark ink={ink} />
        <PrimaryNav isLoggedIn={isLoggedIn} ink={ink} />

        <div className="flex shrink-0 items-center">
          {isLoggedIn ? <AccountMenu ink={ink} /> : <LoginButton ink={ink} />}
        </div>
      </div>
    </header>
  )
}
