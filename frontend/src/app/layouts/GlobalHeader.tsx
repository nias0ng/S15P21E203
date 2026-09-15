import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router'

import { ROUTES } from '@/shared/config/routes'
import { cn } from '@/shared/lib/cn'
import { useAuthStore } from '@/shared/store/authStore'

/**
 * 헤더가 앉는 바탕 — 어느 화면 위인지는 껍데기(RootLayout)가 정합니다.
 *
 *   surface  종이 한 장(ivory) — 기본
 *   paper    진열대의 종이 결 — 본문과 같은 종이
 *   glass    3D 향 지도 위의 유리판 — 뒤의 3D 가 흐리게 비치고 짙은 남색이 살짝 깔립니다
 */
export type HeaderTone = 'surface' | 'paper' | 'glass'

/*
 * 유리판 (3D 향 지도 위)
 * - fixed: 흐름에서 빠져 3D 가 헤더 뒤(화면 맨 위)까지 깔립니다
 * - 짙은 남색을 위 60% → 아래 45% 로 깔아 판에 두께를 줍니다. 한 가지 알파로 깔면 색 띠로 읽힙니다
 * - 뒤를 흐리고(24px) 채도를 조금만 올립니다(125%). 더 올리면 하늘의 살구 · 보랏빛이 살아나
 *   남색이 아니라 자줏빛 판으로 보입니다
 * - 아래 끝 상아색 실선(20%)이 판의 모서리입니다. 테두리로 그으면 헤더가 91px 이 되어 3D 에 알린
 *   90px 과 어긋나므로, 판 안쪽 맨 아래에 1px 을 긋습니다. 옅은 그림자는 판이 떠 있는 높이입니다
 */
const GLASS = cn(
  'fixed inset-x-0',
  'from-surface-night/60 to-surface-night/45 bg-linear-to-b',
  'after:bg-surface/20 after:absolute after:inset-x-0 after:bottom-0 after:h-px',
  'shadow-overlay backdrop-blur-xl backdrop-saturate-125',
)

/*
 * 헤더 위 글자 · 선 · 펼침 메뉴의 색.
 * 유리판(남색) 위에서는 상아색으로 뒤집습니다 — 종이의 먹색은 남색 위에서 읽히지 않습니다.
 * 옅은 글자도 85% 까지만 내립니다. 판 뒤로 밝은 하늘이 비치는 자리가 있어서입니다.
 */
const PAPER_INK = {
  text: 'text-ink',
  hover: 'hover:text-ink-muted',
  muted: 'text-ink-muted',
  open: 'text-ink-muted',
  rule: 'bg-line',
  ring: 'focus-visible:ring-accent-deep',
  menu: 'border-line bg-surface-card',
  item: 'text-ink hover:bg-line-soft',
  itemRule: 'border-line',
  login: 'border-line text-ink hover:bg-line-soft',
}
const GLASS_INK: typeof PAPER_INK = {
  text: 'text-surface',
  hover: 'hover:text-surface/70',
  muted: 'text-surface/85',
  open: 'text-surface/70',
  rule: 'bg-surface/25',
  ring: 'focus-visible:ring-surface focus-visible:ring-offset-surface-night',
  // 펼침 메뉴는 판보다 짙게 깝니다. 판 밖으로 내려와 3D 위에 바로 앉아서, 옅으면 뒤의 부표 · 글자와 섞입니다
  menu: 'border-surface/15 bg-surface-night/90 shadow-overlay',
  item: 'text-surface hover:bg-surface/10',
  itemRule: 'border-surface/15',
  login: 'border-surface/40 text-surface hover:bg-surface/10',
}
type Ink = typeof PAPER_INK

/** 포커스 링 — 링 색은 바탕마다 ink.ring 으로 더합니다 */
const FOCUS =
  'rounded-card outline-none focus-visible:ring-2 focus-visible:ring-offset-2'

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
 * ── 배치 (1920 기준) ──────────────────────────────────────
 *   높이           90
 *   좌우 여백       --gutter (1920 에서 60) — 본문과 같은 값이라 로고가 본문 왼쪽 끝
 *                  (진열장 모서리 · 제목) 바로 위에 섭니다
 *   메뉴 다섯 개    항목 사이 60, 로고와 우측 도구 사이의 정중앙
 *   우측 도구       돋보기 · 계정 · 구분선 · 문구, 사이 30
 *
 * 세 덩어리라 `grid-cols-[auto_1fr_auto]` 입니다. flex + ml-auto 로 하면 메뉴가 좌우
 * 덩어리 폭에 밀려서, 로그인 여부로 오른쪽 폭이 바뀔 때 메뉴가 함께 움직입니다.
 * 가운데를 1fr 로 두면 메뉴가 남는 자리의 정중앙에 섭니다.
 *
 * 폭은 본문과 같은 화면 틀(max-w-frame, 1920)입니다. 바탕은 화면 끝까지 칠하고
 * 내용만 틀 안에 둬서, 1920 보다 넓은 모니터에서도 로고와 본문이 같은 선에 섭니다.
 *
 * 아래 테두리를 뺐습니다. 시안은 헤더와 본문이 같은 종이 한 장이고, 선을 그으면
 * 진열대 화면에서 종이가 두 장으로 잘려 보입니다.
 *
 * 3D 향 지도(메인) 위에서만 유리판(glass)입니다. 거기는 종이가 아니라 저녁 바다라,
 * 헤더가 3D 위에 뜬 얇은 유리로 읽혀야 화면 한 장이 됩니다. 유리판에는 모서리 실선이 있습니다.
 */
export function GlobalHeader({ tone = 'surface' }: { tone?: HeaderTone }) {
  const accessToken = useAuthStore((state) => state.accessToken)
  const isLoggedIn = Boolean(accessToken)
  const ink = tone === 'glass' ? GLASS_INK : PAPER_INK

  return (
    /*
     * paper 인 화면(진열대)에서는 헤더도 본문과 같은 종이를 깝니다. 투명하게
     * 두지 않는 이유: 스크롤한 내용이 로고와 메뉴 밑으로 비쳐 지나갑니다.
     * `.shelf-paper` 가 뷰포트 기준으로 그려져서 본문과 결이 이어집니다.
     */
    <header
      className={cn(
        'top-0 z-20',
        tone === 'glass' ? GLASS : 'sticky',
        tone === 'paper' && 'shelf-scope shelf-paper shelf-grain',
        tone === 'surface' && 'bg-surface',
      )}
    >
      <div className="max-w-frame mx-auto grid h-22.5 grid-cols-[auto_1fr_auto] items-center gap-5 px-[var(--gutter)]">
        <BrandMark ink={ink} />
        <PrimaryNav isLoggedIn={isLoggedIn} ink={ink} />

        {/* 돋보기 · 계정 · 구분선 · 문구 (시안 우측 묶음) */}
        <div className="flex shrink-0 items-center gap-7.5">
          <Link
            to={ROUTES.PERFUME_SEARCH}
            aria-label="향수 검색"
            className={cn(
              ink.text,
              ink.hover,
              'transition-colors duration-120 ease-out',
              FOCUS,
              ink.ring,
            )}
          >
            <SearchIcon />
          </Link>

          {isLoggedIn ? <AccountMenu ink={ink} /> : <LoginButton ink={ink} />}

          {/*
            구분선과 문구는 넓은 화면에서만 나옵니다. 좁아지면 가운데 메뉴가 먼저
            찌그러지는데, 문구는 읽을거리가 아니라 장식이라 먼저 자리를 내주는 쪽입니다.
          */}
          <span
            aria-hidden
            className={cn('hidden h-7.5 w-px xl:block', ink.rule)}
          />
          <p
            className={cn(
              'text-caption hidden leading-relaxed xl:block',
              ink.muted,
            )}
          >
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
function BrandMark({ ink }: { ink: Ink }) {
  return (
    <Link
      to={ROUTES.HOME}
      className={cn('block shrink-0', ink.text, FOCUS, ink.ring)}
    >
      <span className="block font-serif text-[26px] leading-none font-semibold tracking-[0.12em]">
        향해
      </span>
      <span
        aria-hidden
        className={cn(
          'mt-1.25 block text-[10px] leading-none tracking-[0.28em]',
          ink.muted,
        )}
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

function PrimaryNav({ isLoggedIn, ink }: { isLoggedIn: boolean; ink: Ink }) {
  const items = NAV_ITEMS.filter((item) => isLoggedIn || !item.requiresAuth)

  return (
    // 가운데 칸의 정중앙. 항목 사이 60px 은 시안(1671 폭에서 62px)을 1920 규격에
    // 맞추면서 끝자리를 0 으로 둔 값입니다.
    <nav aria-label="주요 메뉴" className="justify-self-center">
      <ul className="text-body flex items-center gap-15">
        {items.map((item) => (
          <li key={item.to}>
            <NavLink to={item.to} className={navLinkClass(ink)}>
              {item.label}
            </NavLink>
          </li>
        ))}
        <li>
          <CommunityMenu ink={ink} />
        </li>
      </ul>
    </nav>
  )
}

/*
 * 시안의 메뉴에는 호버 배경이 없습니다. 종이 위에 인쇄된 차례처럼 보여야 해서
 * 배경 대신 글자색만 옅어지고, 지금 보고 있는 화면만 밑줄로 표시됩니다.
 * 좌우 padding 을 걷어낸 이유: 항목 간격을 60px 로 잡았는데 패딩이 남아 있으면
 * 글자 사이가 시안보다 그만큼 더 벌어집니다.
 */
const navLinkClass =
  (ink: Ink) =>
  ({ isActive }: { isActive: boolean }) =>
    cn(
      'block transition-colors duration-120 ease-out',
      ink.text,
      ink.hover,
      FOCUS,
      ink.ring,
      isActive && 'font-semibold underline underline-offset-[6px]',
    )

/** 커뮤니티 ▾ — 하위가 있는 유일한 메뉴 */
function CommunityMenu({ ink }: { ink: Ink }) {
  const { open, setOpen, containerRef } = useDismissable()

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen(!open)}
        className={cn(
          'text-body transition-colors duration-120 ease-out',
          ink.text,
          ink.hover,
          FOCUS,
          ink.ring,
          open && ink.open,
        )}
      >
        커뮤니티 <span aria-hidden>▾</span>
      </button>

      {open && (
        <ul
          // 와이어프레임 기준 폭 120px
          className={cn(
            'absolute top-full left-0 z-30 mt-2.5 w-30 border',
            ink.menu,
          )}
          role="menu"
        >
          {COMMUNITY_ITEMS.map((item, index) => (
            <li key={item.to} role="none">
              <NavLink
                role="menuitem"
                to={item.to}
                onClick={() => setOpen(false)}
                className={cn(
                  'text-caption block px-2.5 py-2.5',
                  ink.item,
                  index < COMMUNITY_ITEMS.length - 1 &&
                    cn('border-b', ink.itemRule),
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
function AccountMenu({ ink }: { ink: Ink }) {
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
          'block transition-colors duration-120 ease-out',
          ink.text,
          ink.hover,
          FOCUS,
          ink.ring,
          open && ink.open,
        )}
      >
        {/* TODO: 프로필 이미지 연동 (A29 정보 변경에서 업로드) */}
        <AccountIcon />
      </button>

      {open && (
        <ul
          // 와이어프레임 기준 폭 158px, 우측 정렬
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
              className={cn(
                'text-caption block w-full px-2.5 py-2.5 text-left',
                ink.item,
              )}
            >
              로그아웃
            </button>
          </li>
        </ul>
      )}
    </div>
  )
}

function LoginButton({ ink }: { ink: Ink }) {
  return (
    <Link
      to={ROUTES.LOGIN}
      className={cn(
        'rounded-card block border px-2.5 py-1.25',
        ink.login,
        'text-caption transition-colors duration-120 ease-out',
        'outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        ink.ring,
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
