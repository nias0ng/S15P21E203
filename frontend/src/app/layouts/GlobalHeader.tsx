import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router'

import { ROUTES } from '@/shared/config/routes'
import { cn } from '@/shared/lib/cn'
import { useAuthStore } from '@/shared/store/authStore'

/**
 * 전역 헤더 (와이어프레임 N01 · 모든 화면 공통 — 진열장 시안 배치)
 *
 * 와이어프레임 주석 그대로 지킨 것입니다.
 * - 상단 메뉴는 향수 · 브랜드 · 노트 · 진열대 · 커뮤니티 ▾ 다섯 개
 * - 커뮤니티 ▾ 만 하위가 있다 (후기 · 자유). 진열대는 컬렉션까지 한 페이지라 하위 탭이 없다
 * - 비로그인 상태는 우측이 [로그인] 버튼 하나, 좌측 메뉴에서 진열대 제거
 *
 * 마이페이지 화면은 없습니다. 개인 정보 수정은 계정 아이콘에서 바로 들어갑니다.
 *
 * ── 배치 (시안 1671px 기준을 비율로 옮겼습니다) ────────────────
 *   로고 왼쪽 끝    52 / 1671 = 3.1%   시안의 진열장 왼쪽 끝(56)과 거의 같은 선
 *   메뉴 다섯 개    526 ~ 1060         로고와 우측 도구 사이의 정중앙
 *   돋보기 · 계정   1428 · 1482        중심 간격 54, 아이콘 20 이므로 사이 32
 *   구분선          1524               좌우 24 씩
 *   문구            1548 ~ 1610
 *
 * 세 덩어리라 `grid-cols-[auto_1fr_auto]` 입니다. flex + ml-auto 로 하면 메뉴가 좌우
 * 덩어리 폭에 밀려서, 로그인 여부로 오른쪽 폭이 바뀔 때 메뉴가 함께 움직입니다.
 * 가운데를 1fr 로 두면 메뉴가 남는 자리의 정중앙에 서는데, 시안의 메뉴 중심(793)이
 * 로고 끝(190)과 도구 시작(1400)의 한가운데(795)와 맞습니다.
 *
 * 폭을 `max-w-content`(1120px)로 묶지 않습니다. 시안은 로고와 문구가 화면 양 끝에
 * 붙는 구성이고, 진열대 화면도 그 폭을 벗어나 화면을 꽉 채웁니다. 좌우 여백 32px 은
 * 진열대 본문(FULL_BLEED)의 여백과 같은 값이라 로고가 진열장 왼쪽 모서리 바로 위에
 * 섭니다 — 시안이 52 대 56 으로 맞춰 둔 그 관계입니다.
 *
 * 아래 테두리를 뺐습니다. 시안은 헤더와 본문이 같은 종이 한 장이고, 선을 그으면
 * 진열대 화면에서 종이가 두 장으로 잘려 보입니다.
 */
export function GlobalHeader() {
  const accessToken = useAuthStore((state) => state.accessToken)
  const isLoggedIn = Boolean(accessToken)

  return (
    <header className="bg-surface sticky top-0 z-20">
      <div className="grid h-22 grid-cols-[auto_1fr_auto] items-center gap-6 px-8">
        <BrandMark />
        <PrimaryNav isLoggedIn={isLoggedIn} />

        {/* 돋보기 · 계정 · 구분선 · 문구 (시안 우측 묶음) */}
        <div className="flex shrink-0 items-center gap-8">
          <Link
            to={ROUTES.PERFUME_SEARCH}
            aria-label="향수 검색"
            className={cn(
              'text-ink hover:text-ink-muted transition-colors duration-120 ease-out',
              'focus-visible:ring-accent-deep rounded-card outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
            )}
          >
            <SearchIcon />
          </Link>

          {isLoggedIn ? <AccountMenu /> : <LoginButton />}

          {/*
            구분선과 문구는 넓은 화면에서만 나옵니다. 좁아지면 가운데 메뉴가 먼저
            찌그러지는데, 문구는 읽을거리가 아니라 장식이라 먼저 자리를 내주는 쪽입니다.
          */}
          <span aria-hidden className="bg-line hidden h-8 w-px xl:block" />
          <p className="text-ink-muted text-caption hidden leading-relaxed xl:block">
            오늘도,
            <br />
            좋은 향과 함께.
          </p>
        </div>
      </div>
    </header>
  )
}

/* ------------------------------------------------------------------ */

/**
 * 로고 묶음 — 이름 아래 영문 한 줄.
 *
 * 두 줄이 한 링크입니다. 영문 줄을 링크 밖으로 빼면 낭독기의 링크 목록에 뜻이 반쯤
 * 잘린 항목이 하나 더 생깁니다. 영문 줄에 aria-hidden 을 다는 것도 같은 이유입니다 —
 * 자간을 크게 벌린 대문자는 낭독기가 한 글자씩 읽는 일이 있습니다.
 */
function BrandMark() {
  return (
    <Link
      to={ROUTES.HOME}
      className={cn(
        'text-ink block shrink-0',
        'focus-visible:ring-accent-deep rounded-card outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
      )}
    >
      <span className="block font-serif text-[26px] leading-none font-semibold tracking-[0.12em]">
        향해
      </span>
      <span
        aria-hidden
        className="text-ink-muted mt-1.5 block text-[10px] leading-none tracking-[0.28em]"
      >
        SCENT JOURNEY
      </span>
    </Link>
  )
}

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
    // 가운데 칸의 정중앙. 항목 사이 56px 은 시안(1671 기준 62px)을 1440 으로 환산한
    // 53px 에 가장 가까우면서 간격 스케일(8의 배수) 안에 있는 값입니다.
    <nav aria-label="주요 메뉴" className="justify-self-center">
      <ul className="text-body flex items-center gap-14">
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

/*
 * 시안의 메뉴에는 호버 배경이 없습니다. 종이 위에 인쇄된 차례처럼 보여야 해서
 * 배경 대신 글자색만 옅어지고, 지금 보고 있는 화면만 밑줄로 표시됩니다.
 * 좌우 padding 을 걷어낸 이유: 항목 간격을 56px 로 잡았는데 패딩이 남아 있으면
 * 글자 사이가 시안보다 그만큼 더 벌어집니다.
 */
const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'text-ink hover:text-ink-muted block transition-colors duration-120 ease-out',
    'focus-visible:ring-accent-deep rounded-card outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
    isActive && 'font-semibold underline underline-offset-[6px]',
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
          'text-ink hover:text-ink-muted text-body transition-colors duration-120 ease-out',
          'focus-visible:ring-accent-deep rounded-card outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
          open && 'text-ink-muted',
        )}
      >
        커뮤니티 <span aria-hidden>▾</span>
      </button>

      {open && (
        <ul
          // 와이어프레임 기준 폭 120px
          className="border-line bg-surface-card absolute top-full left-0 z-30 mt-2 w-30 border"
          role="menu"
        >
          {COMMUNITY_ITEMS.map((item, index) => (
            <li key={item.to} role="none">
              <NavLink
                role="menuitem"
                to={item.to}
                onClick={() => setOpen(false)}
                className={cn(
                  'text-ink hover:bg-line-soft text-caption block px-3 py-2.5',
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

/**
 * 계정 아이콘 ▾ — 개인 정보 수정 · 로그아웃 두 줄.
 *
 * 시안의 우측은 아이콘 두 개뿐이라 닉네임 칩을 아이콘으로 바꿨습니다. 닉네임은
 * 글자 길이에 따라 폭이 달라져서, 그대로 두면 가운데 메뉴가 사람마다 다른 자리에
 * 섭니다(가운데 칸이 남는 자리의 중앙을 잡기 때문입니다).
 */
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
        aria-label="내 계정"
        onClick={() => setOpen(!open)}
        className={cn(
          'text-ink hover:text-ink-muted block transition-colors duration-120 ease-out',
          'focus-visible:ring-accent-deep rounded-card outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
          open && 'text-ink-muted',
        )}
      >
        {/* TODO: 프로필 이미지 연동 (A29 정보 변경에서 업로드) */}
        <AccountIcon />
      </button>

      {open && (
        <ul
          // 와이어프레임 기준 폭 158px, 우측 정렬
          className="border-line bg-surface-card absolute top-full right-0 z-30 mt-2 w-[158px] border"
          role="menu"
        >
          <li role="none">
            <Link
              role="menuitem"
              to={ROUTES.ACCOUNT}
              onClick={() => setOpen(false)}
              className="text-ink hover:bg-line-soft border-line text-caption block border-b px-3 py-2.5"
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
              className="text-ink hover:bg-line-soft text-caption block w-full px-3 py-2.5 text-left"
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
      className={cn(
        'border-line text-ink hover:bg-line-soft rounded-card block border px-3 py-1.5',
        'text-caption transition-colors duration-120 ease-out',
        'focus-visible:ring-accent-deep outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
      )}
    >
      로그인
    </Link>
  )
}

/* ------------------------------------------------------------------ */

/** 돋보기. 아이콘 하나 때문에 라이브러리를 붙이지 않습니다 */
function SearchIcon() {
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
      <circle cx="9" cy="9" r="5.75" />
      <path d="m13.5 13.5 4 4" />
    </svg>
  )
}

/** 사람 실루엣 */
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
