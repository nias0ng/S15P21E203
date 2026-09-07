import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router'

import { ROUTES } from '@/shared/config/routes'
import { cn } from '@/shared/lib/cn'
import { useAuthStore } from '@/shared/store/authStore'

/**
 * 전역 헤더 (와이어프레임 N01 · 모든 화면 공통)
 *
 * 와이어프레임 주석 그대로 지킨 것 네 가지입니다.
 * - 상단 메뉴는 향수 · 브랜드 · 노트 · 진열대 · 커뮤니티 ▾ 다섯 개
 * - 헤더에 검색창은 없다 (검색은 각 페이지 안에 있다)
 * - 커뮤니티 ▾ 만 하위가 있다 (후기 · 자유). 진열대는 컬렉션까지 한 페이지라 하위 탭이 없다
 * - 비로그인 상태는 우측이 [로그인] 버튼 하나, 좌측 메뉴에서 진열대 제거
 *
 * 마이페이지 화면은 없습니다. 개인 정보 수정은 닉네임 ▾ 에서 바로 들어갑니다.
 */
export function GlobalHeader() {
  const accessToken = useAuthStore((state) => state.accessToken)
  const isLoggedIn = Boolean(accessToken)

  return (
    <header className="border-line bg-surface sticky top-0 z-20 border-b">
      <div className="max-w-content mx-auto flex h-13 items-center gap-6 px-5">
        <Link
          to={ROUTES.HOME}
          className="text-ink shrink-0 text-base font-bold tracking-[0.06em]"
        >
          향해
        </Link>

        <PrimaryNav isLoggedIn={isLoggedIn} />

        <div className="ml-auto shrink-0">
          {isLoggedIn ? <AccountMenu /> : <LoginButton />}
        </div>
      </div>
    </header>
  )
}

/* ------------------------------------------------------------------ */

const NAV_ITEMS = [
  { to: ROUTES.PERFUMES, label: '향수' },
  { to: ROUTES.BRANDS, label: '브랜드' },
  { to: ROUTES.NOTES, label: '노트' },
  // 진열대는 로그인해야 보입니다 (와이어프레임: 비로그인 시 좌측 메뉴에서 제거)
  { to: ROUTES.MY_SHELF, label: '진열대', requiresAuth: true },
]

const COMMUNITY_ITEMS = [
  { to: ROUTES.COMMUNITY_REVIEWS, label: '후기' },
  { to: ROUTES.COMMUNITY_FREE, label: '자유' },
]

function PrimaryNav({ isLoggedIn }: { isLoggedIn: boolean }) {
  const items = NAV_ITEMS.filter((item) => isLoggedIn || !item.requiresAuth)

  return (
    <nav aria-label="주요 메뉴">
      <ul className="flex items-center gap-1.5 text-xs">
        {items.map((item) => (
          <li key={item.to}>
            <NavLink to={item.to} className={navLinkClass}>
              {item.label}
            </NavLink>
          </li>
        ))}
        <li>
          <CommunityMenu />
        </li>
      </ul>
    </nav>
  )
}

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'block rounded px-2 py-1 text-ink transition-colors hover:bg-line-soft',
    isActive && 'font-semibold underline underline-offset-4',
  )

/** 커뮤니티 ▾ — 하위가 있는 유일한 메뉴 */
function CommunityMenu() {
  const { open, setOpen, containerRef } = useDismissable()

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen(!open)}
        className={cn(
          'text-ink hover:bg-line-soft rounded px-2 py-1 text-xs transition-colors',
          open && 'bg-line-soft',
        )}
      >
        커뮤니티 <span aria-hidden>▾</span>
      </button>

      {open && (
        <ul
          // 와이어프레임 기준 폭 120px
          className="border-line absolute top-full left-0 z-30 mt-px w-30 border bg-white"
          role="menu"
        >
          {COMMUNITY_ITEMS.map((item, index) => (
            <li key={item.to} role="none">
              <NavLink
                role="menuitem"
                to={item.to}
                onClick={() => setOpen(false)}
                className={cn(
                  'text-ink hover:bg-line-soft block px-3 py-2.5 text-xs',
                  index < COMMUNITY_ITEMS.length - 1 && 'border-line border-b',
                )}
              >
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** 프로필 이미지 + 닉네임 ▾ — 개인 정보 수정 · 로그아웃 두 줄 */
function AccountMenu() {
  const navigate = useNavigate()
  const clear = useAuthStore((state) => state.clear)
  const { open, setOpen, containerRef } = useDismissable()

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen(!open)}
        className="bg-ink flex items-center gap-2 px-2 py-[3px] text-xs text-white"
      >
        {/* TODO: 프로필 이미지 연동 (A29 정보 변경에서 업로드) */}
        <span
          aria-hidden
          className="border-line bg-line-soft size-6.5 shrink-0 rounded-full border"
        />
        <span>
          유저닉네임 <span aria-hidden>▾</span>
        </span>
      </button>

      {open && (
        <ul
          // 와이어프레임 기준 폭 158px, 우측 정렬
          className="border-line absolute top-full right-0 z-30 mt-px w-[158px] border bg-white"
          role="menu"
        >
          <li role="none">
            <Link
              role="menuitem"
              to={ROUTES.ACCOUNT}
              onClick={() => setOpen(false)}
              className="text-ink hover:bg-line-soft border-line block border-b px-3 py-2.5 text-xs"
            >
              개인 정보 수정
            </Link>
          </li>
          <li role="none">
            <button
              role="menuitem"
              type="button"
              onClick={() => {
                clear()
                setOpen(false)
                navigate(ROUTES.HOME)
              }}
              className="text-ink hover:bg-line-soft block w-full px-3 py-2.5 text-left text-xs"
            >
              로그아웃
            </button>
          </li>
        </ul>
      )}
    </div>
  )
}

function LoginButton() {
  return (
    <Link
      to={ROUTES.LOGIN}
      className="border-line text-ink hover:bg-line-soft block border px-3 py-1.5 text-xs transition-colors"
    >
      로그인
    </Link>
  )
}

/* ------------------------------------------------------------------ */

/**
 * 드롭다운 공통 동작: 바깥 클릭과 Esc 로 닫기.
 *
 * 헤더 안에서만 두 번 쓰이므로 여기 둡니다. 다른 도메인에서도 필요해지면
 * shared/hooks 로 올립니다 (frontend/CLAUDE.md 의 공용화 시점 규칙).
 */
function useDismissable() {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return { open, setOpen, containerRef }
}
