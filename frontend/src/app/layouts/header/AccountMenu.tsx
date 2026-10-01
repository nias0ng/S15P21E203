import { useMutation, useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'

import { logout, meQuery } from '@/features/auth'
import { ROUTES } from '@/shared/config/routes'
import { useEndSession } from '@/shared/hooks/useEndSession'
import { cn } from '@/shared/lib/cn'
import { useIsLoggedIn } from '@/shared/store/authStore'
import { Thumbnail } from '@/shared/ui/Thumbnail'

import { inkLink, type Ink } from './tone'
import { useDismissable } from './useDismissable'

function AccountIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      className="size-5"
    >
      <circle cx="10" cy="6.5" r="3.25" />
      <path d="M3.75 17c0-3.2 2.8-5 6.25-5s6.25 1.8 6.25 5" />
    </svg>
  )
}

export function AccountMenu({ ink }: { ink: Ink }) {
  const { t } = useTranslation(['layout', 'common'])
  const navigate = useNavigate()
  const endSession = useEndSession()
  const { open, setOpen, containerRef } = useDismissable()

  /* 사진 주소는 서버가 쥔 값이라 쿼리에서 읽습니다 — 정보 변경 화면과 같은 캐시라 요청이 늘지 않습니다 */
  const isLoggedIn = useIsLoggedIn()
  const { data: me } = useQuery({ ...meQuery(), enabled: isLoggedIn })

  /*
   * refresh 토큰이 httpOnly 쿠키라 서버에도 알려야 로그아웃입니다. 실패해도 이
   * 브라우저에서는 나가도록 `onSettled` 에서 비우고, 캐시도 함께 비웁니다 —
   * 먼저 비우면 이 요청에 Authorization 이 안 붙어 서버 세션이 남습니다.
   */
  const logoutMutation = useMutation({
    mutationFn: logout,
    onSettled: endSession,
  })

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={t('header.account')}
        onClick={() => setOpen(!open)}
        className={cn('block', inkLink(ink), open && ink.open)}
      >
        {/* 사진이 없을 때 `Thumbnail` 을 쓰면 빈 상자가 서서, 그때는 원래 아이콘을 둡니다 */}
        {me?.profileImageUrl != null ? (
          <Thumbnail
            src={me.profileImageUrl}
            alt={t('header.profilePhoto')}
            bare
            className="size-5 rounded-full object-cover"
          />
        ) : (
          <AccountIcon />
        )}
      </button>

      {open && (
        <ul
          className={cn(
            'absolute top-full right-0 z-30 mt-2.5 w-40 border',
            ink.menu,
          )}
          role="menu"
        >
          <li role="none">
            <Link
              role="menuitem"
              to={ROUTES.ACCOUNT}
              onClick={() => setOpen(false)}
              className={cn(
                'text-caption block border-b px-2.5 py-2.5',
                ink.item,
                ink.itemRule,
              )}
            >
              {t('header.editProfile')}
            </Link>
          </li>
          <li role="none">
            <button
              role="menuitem"
              type="button"
              onClick={() => {
                logoutMutation.mutate()
                setOpen(false)
                navigate(ROUTES.HOME)
              }}
              className={cn(
                'text-caption block w-full px-2.5 py-2.5 text-left',
                ink.item,
              )}
            >
              {t('common:actions.logOut')}
            </button>
          </li>
        </ul>
      )}
    </div>
  )
}
