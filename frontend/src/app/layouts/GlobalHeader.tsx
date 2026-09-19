import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router'

import { logout } from '@/features/auth'
import { ROUTES } from '@/shared/config/routes'
import { cn } from '@/shared/lib/cn'
import { useAuthStore } from '@/shared/store/authStore'
import { useDiveStore } from '@/shared/store/diveStore'

/**
 * 헤더가 앉는 바탕 — 어느 화면 위인지는 껍데기(RootLayout)가 정합니다.
 *
 *   surface     종이 한 장(ivory) — 기본
 *   paper       진열대의 종이 결 — 본문과 같은 종이
 *   glass       3D 향 지도 위의 거의 투명한 유리 — 밤하늘 위라 상아색 글자
 *   glassLight  같은 유리 — 밝은 하늘(낮 · 저녁) 위라 먹색 글자
 */
export type HeaderTone = 'surface' | 'paper' | 'glass' | 'glassLight'

/*
 * 유리판 (3D 향 지도 위) — 거의 투명한 유리입니다
 * - fixed: 흐름에서 빠져 3D 가 헤더 뒤(화면 맨 위)까지 깔립니다
 * - 판의 옅은 색(25%)과 흐림(4px)은 before 층에 깔고, 아래로 갈수록 0 으로 녹입니다(mask).
 *   아래 끝에서 딱 끊기면 그 선이 곧 판의 경계로 읽혀 3D 와 따로 떨어진 띠가 됩니다
 * - 예전의 짙은 남색(60% → 45%) · 흐림 24px · 그림자 · 아래 상아색 실선을 걷었습니다 — 뒤의 하늘 ·
 *   바다 색이 그대로 비쳐야 헤더와 3D 가 한 화면으로 읽힙니다
 * - 판이 옅어져 글자가 뒤의 하늘 위에 바로 앉습니다 — 그래서 판의 색 · 글자색 · 글자 그림자가 하늘을
 *   따릅니다 (아래 GLASS_INK · GLASS_LIGHT_INK 의 tint · text · shadow). 그림자는 상속되므로 헤더에 한 번 겁니다
 */
const GLASS = cn(
  'fixed inset-x-0',
  'before:pointer-events-none before:absolute before:inset-0 before:-z-10',
  'before:bg-linear-to-b before:to-transparent before:backdrop-blur-xs',
  'before:[mask-image:linear-gradient(to_bottom,black_40%,transparent)]',
)

/*
 * 헤더 위 글자 · 선 · 펼침 메뉴의 색.
 * 유리판(남색) 위에서는 상아색으로 뒤집습니다 — 종이의 먹색은 남색 위에서 읽히지 않습니다.
 */
type Ink = {
  /** 유리판의 옅은 색 — 유리(glass · glassLight)에만 씁니다 */
  tint: string
  /** 글자 그림자. 상속되므로 헤더에 한 번 겁니다 */
  shadow: string
  text: string
  hover: string
  open: string
  ring: string
  menu: string
  item: string
  itemRule: string
  login: string
}

/*
 * 밤하늘 위 유리 — 남색 판 · 상아색 글자 · 남색 그림자.
 * 2026-09-16 실측 (헤더 띠의 밤하늘) : 상아색 최저 7.4:1. 먹색으로 두면 1.2:1 이라 꼭 바꿔야 합니다
 */
const GLASS_INK: Ink = {
  tint: 'before:from-surface-night/25',
  shadow: 'text-shadow-xs text-shadow-surface-night/40',
  text: 'text-surface',
  hover: 'hover:text-surface/70',
  open: 'text-surface/70',
  ring: 'focus-visible:ring-surface focus-visible:ring-offset-surface-night',
  // 펼침 메뉴는 판보다 짙게 깝니다. 판 밖으로 내려와 3D 위에 바로 앉아서, 옅으면 뒤의 부표 · 글자와 섞입니다
  menu: 'border-surface/15 bg-surface-night/90 shadow-overlay',
  item: 'text-surface hover:bg-surface/10',
  itemRule: 'border-surface/15',
  login: 'border-surface/40 text-surface hover:bg-surface/10',
}
/*
 * 밝은 하늘(낮 · 저녁) 위 유리 — 상아색 판 · 먹색 글자 · 상아색 그림자.
 * 거의 투명한 판 뒤로 살구색 하늘이 그대로 비쳐 상아색 글자는 대비가 1.7:1 까지 떨어졌습니다.
 * 2026-09-16 실측 (헤더 띠 저녁 하늘의 상대 휘도 0.38 ~ 0.56) :
 *   먹색 + 남색 판 최저 4.3:1 → 먹색 + 상아색 판(25%) 최저 6.4:1
 * 남색 판은 먹색 글자 뒤를 더 어둡게 해서 오히려 대비를 깎습니다 — 그래서 판의 색도 하늘을 따릅니다.
 * 펼침 메뉴는 판 밖 3D 위에 바로 앉으므로 종이 카드로 깝니다.
 */
const GLASS_LIGHT_INK: Ink = {
  tint: 'before:from-surface/25',
  shadow: 'text-shadow-xs text-shadow-surface/40',
  text: 'text-ink',
  hover: 'hover:text-ink/70',
  open: 'text-ink/70',
  ring: 'focus-visible:ring-accent-deep',
  menu: 'border-line bg-surface-card shadow-overlay',
  item: 'text-ink hover:bg-line-soft',
  itemRule: 'border-line',
  login: 'border-ink/40 text-ink hover:bg-surface/40',
}

/*
 * 종이 화면(surface · paper) — **메인의 밝은 하늘(GLASS_LIGHT_INK)과 같은 값**입니다.
 *
 * 2026-09-16 사용자 : "상단 헤더 통일화 · 메인페이지 기준으로 전체 페이지". 예전에는 종이 화면이
 * 제 값을 따로 들고 있어서 글자 그림자 · 마우스를 올린 색(ink-muted) · 펼침 메뉴 그림자 ·
 * [로그인] 테두리가 메인과 조금씩 달랐습니다.
 *
 * 다른 것은 둘뿐입니다.
 * - 판의 옅은 색(tint)이 없습니다 — 종이 화면은 헤더가 본문과 같은 종이를 깝니다(아래 GlobalHeader)
 * - [로그인]에 마우스를 올린 바탕 — 메인의 상아색 40% 는 종이 위에서 안 보여 누를 수 있다는 표시가 사라집니다
 *
 * 향수 목록의 어두운 방(`.scent-night`)은 ink · surface 토큰을 어둠 기준으로 다시 정의하므로,
 * 같은 값이 그대로 상아색 글자 · 어두운 그림자가 됩니다 — 메인의 밤하늘(GLASS_INK)과 같은 짝입니다.
 */
const PAPER_INK: Ink = {
  ...GLASS_LIGHT_INK,
  tint: '',
  login: 'border-ink/40 text-ink hover:bg-line-soft',
}

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
 *   우측 도구       돋보기 · 계정, 사이 30
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
 * 3D 향 지도(메인) 위에서만 유리판(glass · glassLight)입니다. 거기는 종이가 아니라 저녁 바다라,
 * 헤더가 3D 위에 뜬 거의 투명한 유리로 읽혀야 화면 한 장이 됩니다. 판의 경계선은 두지 않습니다.
 */
export function GlobalHeader({ tone = 'surface' }: { tone?: HeaderTone }) {
  const accessToken = useAuthStore((state) => state.accessToken)
  const isLoggedIn = Boolean(accessToken)
  const onGlass = tone === 'glass' || tone === 'glassLight'
  const ink =
    tone === 'glass'
      ? GLASS_INK
      : tone === 'glassLight'
        ? GLASS_LIGHT_INK
        : PAPER_INK

  return (
    /*
     * paper 인 화면(진열대)에서는 헤더도 본문과 같은 종이를 깝니다. 투명하게
     * 두지 않는 이유: 스크롤한 내용이 로고와 메뉴 밑으로 비쳐 지나갑니다.
     * `.shelf-paper` 가 뷰포트 기준으로 그려져서 본문과 결이 이어집니다.
     *
     * ⚠ 폭은 **화면 폭(100vw)** 입니다 (`w-screen`). 스크롤바를 뺀 폭으로 두면 세로
     * 스크롤이 생기는 화면(목록 · 상세)에서 1920 기준 메뉴가 7.5px, 돋보기 · 계정이 15px
     * 왼쪽으로 밀려, 스크롤이 없는 메인과 헤더가 어긋났습니다(2026-09-16 실측).
     * 스크롤바 밑으로 나간 15px 은 RootLayout 이 잘라냅니다(`overflow-x-clip`).
     * 로고는 왼쪽 여백에 붙어 있어 본문 왼쪽 끝과 그대로 맞습니다.
     *
     * ⚠⚠ `sm`(640) 부터입니다. 그보다 좁으면 헤더 내용(390 에서 458px)이 화면보다 넓어
     *   돋보기 · 계정이 오른쪽 밖으로 나갑니다 — 잘라내면 아예 못 누릅니다. 휴대폰은 스크롤바가
     *   화면 위에 떠서 밀림도 없습니다. 좁은 화면의 헤더는 배치를 바꿔야 할 자리입니다.
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

        {/* 돋보기 · 계정 (시안 우측 묶음 — 구분선 · '오늘도, 좋은 향과 함께.' 문구는 2026-09-16 에 뺐습니다) */}
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
        </div>
      </div>
    </header>
  )
}

/* ------------------------------------------------------------------ */

/**
 * 로고 — 이름 한 줄.
 *
 * 이름 아래의 영문 한 줄(SCENT JOURNEY)은 2026-09-16 에 모든 화면에서 뺐습니다.
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
    </Link>
  )
}

const NAV_ITEMS = [
  { to: ROUTES.PERFUMES, label: '향수' },
  { to: ROUTES.BRANDS, label: '브랜드' },
  { to: ROUTES.NOTES, label: '노트' },
  // 진열대는 로그인해야 보입니다 (와이어프레임: 비로그인 시 좌측 메뉴에서 제거)
  // ⭐ 메인(3D 향 지도)에서 누르면 곧바로 옮겨 가지 않고 **잠수 연출**로 넘어갑니다 (아래 dive)
  { to: ROUTES.MY_SHELF, label: '진열대', requiresAuth: true, dive: true },
]

const COMMUNITY_ITEMS = [
  { to: ROUTES.COMMUNITY_REVIEWS, label: '후기' },
  { to: ROUTES.COMMUNITY_FREE, label: '자유' },
]

function PrimaryNav({ isLoggedIn, ink }: { isLoggedIn: boolean; ink: Ink }) {
  const items = NAV_ITEMS.filter((item) => isLoggedIn || !item.requiresAuth)
  const onMain = useLocation().pathname === ROUTES.HOME
  const queryClient = useQueryClient()
  const startDive = useDiveStore((state) => state.start)

  /*
   * 진열대를 미리 받아 둡니다 — 마우스를 올리거나 탭으로 옮겨 온 순간입니다.
   *
   * 잠수는 1초에 끝나는데 진열대는 청크(약 48KB)와 목록 API 왕복이 남아 있습니다. 미리
   * 안 받으면 커튼이 덮은 뒤 그 둘을 기다리느라 남색 화면이 상한(1.5초)까지 서 있습니다.
   * 마우스를 올린 순간이면 대개 누르기 전에 둘 다 끝납니다.
   *
   * ⚠ `lazy()` 와 **같은 모듈 캐시**라 미리 부르면 라우터가 기다릴 것이 없습니다.
   * ⚠ 목록은 `staleTime` 안이면 다시 안 받습니다 — 여러 번 올려도 요청이 쌓이지 않습니다.
   */
  const warmShelf = () => {
    void import('@/pages/MyShelfPage')
    /*
      ⚠⚠ **진열대 도메인은 `import()` 로 부릅니다 — 위에서 정적으로 import 하면 안 됩니다.**
      헤더는 첫 번들(main)에 들어 있어서, 정적으로 쓰면 진열대의 컴포넌트 · 쿼리 · 전용
      스타일시트(`shelf-display.css` — 도메인 입구가 같이 싣습니다)가 **메인 화면 첫 진입에
      통째로 딸려 옵니다.**
      실측 (2026-09-18 빌드) : 정적 import 면 main **305.7KB** · main.css **93.9KB** 이고 진열대
      청크가 아예 없습니다. `import()` 면 main **266.2KB** · main.css **70.8KB** 이고 진열대가
      제 청크로 떨어집니다 (shelf 51.2KB + shelf.css 23.1KB — 메인 첫 진입은 그것을 안 받습니다).
    */
    void import('@/features/shelf').then(({ shelfItemsQuery }) =>
      queryClient.prefetchQuery(shelfItemsQuery()),
    )
  }

  return (
    // 가운데 칸의 정중앙. 항목 사이 60px 은 시안(1671 폭에서 62px)을 1920 규격에
    // 맞추면서 끝자리를 0 으로 둔 값입니다.
    <nav aria-label="주요 메뉴" className="justify-self-center">
      <ul className="text-body flex items-center gap-15">
        {items.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              className={navLinkClass(ink)}
              onPointerEnter={item.dive ? warmShelf : undefined}
              onFocus={item.dive ? warmShelf : undefined}
              onClick={
                /*
                  메인에서 진열대로 갈 때만 가로챕니다 — 3D 카메라가 수면으로 내려가고
                  커튼이 차오른 **뒤에** 커튼이 직접 옮겨 갑니다 (shared/ui/DiveCurtain).
                  ⚠ 새 탭 · 새 창으로 여는 누름(⌘ · Ctrl · Shift · Alt)은 건드리지 않습니다 —
                    가로채면 링크가 링크이기를 그만둡니다.
                  ⚠ 메인이 아니면 평소의 NavLink 입니다. 잠수는 바다에서 시작해야 뜻이 있습니다.
                */
                item.dive && onMain
                  ? (event) => {
                      if (
                        event.metaKey ||
                        event.ctrlKey ||
                        event.shiftKey ||
                        event.altKey
                      ) {
                        return
                      }
                      event.preventDefault()
                      warmShelf()
                      startDive(item.to)
                    }
                  : undefined
              }
            >
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
 *
 * ⚠ 지금 화면은 **밑줄만** 긋고 굵게 하지 않습니다 (2026-09-16 헤더 통일). 굵게 하면 그 글자
 * 폭이 늘어 정중앙에 선 메뉴 다섯 개가 화면마다 조금씩 옮겨 가고, 굵은 메뉴가 없는 메인과
 * 글자 무게가 달라집니다. 밑줄은 자리를 차지하지 않습니다.
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
      isActive && 'underline underline-offset-[6px]',
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
  const queryClient = useQueryClient()
  const clear = useAuthStore((state) => state.clear)
  const { open, setOpen, containerRef } = useDismissable()

  /*
   * 스토어를 비우는 것만으로는 로그아웃이 아닙니다. refresh 토큰은 httpOnly
   * 쿠키라 화면이 지울 수 없고, 서버에 알리지 않으면 그 쿠키로 다시 액세스
   * 토큰을 받을 수 있습니다.
   *
   * 요청이 실패해도 이 브라우저에서는 반드시 나가지도록 `onSettled` 에서 비웁니다.
   * 캐시도 함께 비워야 다음 사람이 앞 사람의 화면을 보지 않습니다.
   */
  const logoutMutation = useMutation({
    mutationFn: logout,
    onSettled: () => {
      clear()
      queryClient.clear()
    },
  })

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
                // 토큰을 비우는 것은 onSettled 입니다 — 먼저 비우면 이 요청에
                // Authorization 이 안 붙어 서버 세션이 남습니다
                logoutMutation.mutate()
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
