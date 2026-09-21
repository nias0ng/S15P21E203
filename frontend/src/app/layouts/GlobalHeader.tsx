import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router'

import { logout } from '@/features/auth'
import { ROUTES } from '@/shared/config/routes'
import { cn } from '@/shared/lib/cn'
import { diveDepthOf, riseDepthOf } from '@/shared/lib/diveTrack'
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
 * 유리판 (3D 향 지도 위). `fixed` 라 3D 가 헤더 뒤까지 깔리고, 판이 옅어 **판의 색 ·
 * 글자색 · 그림자가 뒤의 하늘을 따릅니다**(아래 GLASS_INK · GLASS_LIGHT_INK).
 */
const GLASS = cn(
  'fixed inset-x-0',
  'before:pointer-events-none before:absolute before:inset-0 before:-z-10',
  'before:bg-linear-to-b before:to-transparent before:backdrop-blur-xs',
  'before:[mask-image:linear-gradient(to_bottom,black_40%,transparent)]',
)

/* 헤더 위 글자 · 선 · 펼침 메뉴의 색 */
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
 * 밤하늘 위 유리. 2026-09-16 실측 — 상아색 최저 7.4:1, 먹색으로 두면 1.2:1 입니다.
 */
const GLASS_INK: Ink = {
  tint: 'before:from-surface-night/25',
  shadow: 'text-shadow-xs text-shadow-surface-night/40',
  text: 'text-surface',
  hover: 'hover:text-surface/70',
  open: 'text-surface/70',
  ring: 'focus-visible:ring-surface focus-visible:ring-offset-surface-night',
  menu: 'border-surface/15 bg-surface-night/90 shadow-overlay',
  item: 'text-surface hover:bg-surface/10',
  itemRule: 'border-surface/15',
  login: 'border-surface/40 text-surface hover:bg-surface/10',
}
/*
 * 밝은 하늘(낮 · 저녁) 위 유리. 상아색 글자는 살구색 하늘이 비쳐 1.7:1 까지
 * 떨어졌습니다. 2026-09-16 실측(헤더 띠 저녁 하늘 상대 휘도 0.38 ~ 0.56) —
 * 먹색 + 남색 판 최저 4.3:1, 먹색 + 상아색 판(25%) 최저 6.4:1.
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
 * 종이 화면 — **메인의 밝은 하늘과 같은 값**입니다(2026-09-16 "헤더 통일화").
 * 따로 들고 있던 때는 그림자 · hover · 테두리가 메인과 조금씩 달랐습니다.
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
 * 전역 헤더 (N01 · 모든 화면 공통). 마이페이지 화면은 없습니다 — 개인 정보 수정은
 * 계정 아이콘에서 바로 들어갑니다. `grid-cols-[auto_1fr_auto]` 인 이유: flex +
 * ml-auto 면 로그인 여부로 오른쪽 폭이 바뀔 때 가운데 메뉴가 함께 움직입니다.
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

/* ------------------------------------------------------------------ */

/*
 * ───────── 잠수를 거는 자리 (2026-09-18 · 2026-09-20 다섯 화면으로) ─────────
 *
 * 메인(3D 향 지도)과 콘텐츠 화면 사이를 넘을 때만 3D 카메라가 수면으로 내려가고 커튼이 차오릅니다
 * (`shared/ui/DiveCurtain`). 여기가 그 **유일한 입구**입니다 — 헤더 말고는 두 쪽을 잇는 길이 없습니다.
 *
 * ⚠⚠ **어느 화면이 잠수 대상인지 헤더가 알지 않습니다.** `diveDepthOf(주소)` 가 깊이를 주면
 *   대상이고 `null` 이면 아닙니다 (`shared/lib/diveTrack` 의 `DIVE_DEPTH`). 헤더에 목록을
 *   또 적으면 화면이 늘 때 두 곳을 고치게 되고, 한쪽만 고쳐집니다.
 * ⚠⚠ **메인 경계를 넘을 때만입니다.** 콘텐츠끼리(향수 → 브랜드)는 즉시 넘어갑니다 — 이미 물
 *   밑인데 물을 다시 건널 까닭이 없고, 메뉴로 목록 사이를 오가는 일이 매번 1.4초씩 걸리면
 *   메뉴가 무거워집니다.
 */

/** 새 탭 · 새 창으로 여는 누름 — 가로채면 링크가 링크이기를 그만둡니다 */
const opensElsewhere = (event: React.MouseEvent) =>
  event.metaKey || event.ctrlKey || event.shiftKey || event.altKey

/**
 * **메인에서** 콘텐츠 화면으로 나가는 누름을 가로챕니다 — 그 자리가 아니면 `undefined`,
 * 즉 평소의 `NavLink` 입니다.
 *
 * 주요 메뉴(향수 · 브랜드 · 노트)와 커뮤니티 펼침 메뉴(후기 · 자유)가 **이 하나**를 같이 씁니다.
 * 둘로 나누면 한쪽에만 깊이를 넘기거나 한쪽만 보조키를 놓치게 됩니다.
 */
function useDiveOut() {
  const onMain = useLocation().pathname === ROUTES.HOME
  const startDive = useDiveStore((state) => state.start)
  const warm = useWarm()

  return (to: string) => {
    const depth = diveDepthOf(to)
    if (!onMain || depth === null) return undefined
    return (event: React.MouseEvent) => {
      if (opensElsewhere(event)) return
      // 덮은 **뒤에** 커튼이 직접 옮겨 갑니다 — 먼저 옮기면 3D 가 사라진 자리가 한 장 비칩니다
      event.preventDefault()
      warm(to)
      startDive(to, 'dive', depth)
    }
  }
}

/**
 * 로고 — 이름 한 줄.
 *
 * ⭐ **어두운 방 어디서 누르든 떠오릅니다** (2026-09-19 · 2026-09-20 다섯 화면으로 · 상세까지).
 * 거기서 메인으로 가는 길이 여기 하나뿐이라 돌아오는 연출의 입구도 여기입니다.
 * ⚠ 나가는 길보다 **넓습니다** — `riseDepthOf` 는 목록 다섯이 아니라 그 **방 전체**를 봅니다
 *   (까닭은 그 함수 주석). 들어가는 문만 좁습니다.
 * ⚠ 로그아웃의 `navigate(ROUTES.HOME)`(아래 계정 메뉴)은 이 길이 아닙니다 — 로그인이
 *   풀리는데 바다로 떠오르면 무슨 일이 일어난 건지 흐려집니다.
 */
function BrandMark({ ink }: { ink: Ink }) {
  /*
    떠오르는 깊이는 **지금 서 있는 방**의 깊이입니다 — 내려간 만큼 올라옵니다. 상세에 있어도
    그 방의 목록이 내려온 깊이를 그대로 씁니다.
    ⚠ 그래서 주소를 여기서 봅니다. 커튼은 이미 주소가 바뀐 뒤에 움직여서 어디서 왔는지 모릅니다.
  */
  const depth = riseDepthOf(useLocation().pathname)
  const startDive = useDiveStore((state) => state.start)
  return (
    <Link
      to={ROUTES.HOME}
      onClick={
        /*
          콘텐츠 화면에서 누를 때만 가로챕니다 — 커튼이 위에서 덮은 **뒤에** 커튼이 옮겨 갑니다.
          ⚠ 뒤로 가기(브라우저)는 못 가로챕니다 — 그때는 평소대로 넘어갑니다.
        */
        depth === null
          ? undefined
          : (event) => {
              if (opensElsewhere(event)) return
              event.preventDefault()
              startDive(ROUTES.HOME, 'rise', depth)
            }
      }
      className={cn('block shrink-0', ink.text, FOCUS, ink.ring)}
    >
      <span className="block font-serif text-[26px] leading-none font-semibold tracking-[0.12em]">
        향해
      </span>
    </Link>
  )
}

/*
 * ⭐ 향수 · 브랜드 · 노트는 메인에서 누르면 곧바로 옮겨 가지 않고 **잠수 연출**로 넘어갑니다
 *   (위 `useDiveOut`). 여기에는 적지 않습니다 — `diveDepthOf` 가 압니다.
 * ⚠ **진열대는 잠수가 아닙니다** (2026-09-20 에 뺐습니다). 배 선실이 확대되며 안으로 들어가는
 *   별도 연출로 갈 자리라, 바다로 내려가는 축에 같이 세워 두면 둘이 서로를 흉내 냅니다.
 *   미리 받는 것(아래 `useWarm`)은 그대로 둡니다 — 그쪽은 연출이 아니라 무게 때문입니다.
 */
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

/**
 * 잠수로 가는 화면의 **청크**를 미리 받습니다 — 라우터의 `lazy()` 와 **같은 모듈 캐시**라
 * 미리 부르면 라우터가 기다릴 것이 없습니다 (`app/router/index.tsx` 의 그 import 와 같은 경로).
 *
 * ⚠ 잠수는 1초 남짓에 끝나는데 도착 화면은 청크와 목록 API 왕복이 남아 있습니다. 미리 안 받으면
 *   커튼이 덮은 뒤 그 둘을 기다리느라 덮인 화면이 상한(`READY_CAP_MS`)까지 서 있습니다.
 *   마우스를 올린 순간이면 대개 누르기 전에 청크가 끝납니다.
 * ⚠ **정적 import 를 쓰면 안 됩니다.** 헤더는 첫 번들(main)에 들어 있어서, 정적으로 쓰면 이
 *   화면 여섯의 컴포넌트 · 쿼리 · 전용 스타일시트가 **메인 첫 진입에 통째로 딸려 옵니다**
 *   (아래 진열대 주석의 실측이 그 이야기입니다).
 */
const PAGE_CHUNK: Readonly<Record<string, () => Promise<unknown>>> = {
  [ROUTES.PERFUMES]: () => import('@/pages/PerfumeListPage'),
  [ROUTES.BRANDS]: () => import('@/pages/BrandListPage'),
  [ROUTES.NOTES]: () => import('@/pages/NoteListPage'),
  [ROUTES.COMMUNITY_REVIEWS]: () => import('@/pages/ReviewBoardPage'),
  [ROUTES.COMMUNITY_FREE]: () => import('@/pages/FreeBoardPage'),
  [ROUTES.MY_SHELF]: () => import('@/pages/MyShelfPage'),
}

/**
 * 이 주소의 화면을 미리 받아 둡니다 — 마우스를 올리거나 탭으로 옮겨 온 순간입니다.
 * 잠수를 걸 때 한 번 더 부릅니다 (마우스를 안 거치고 탭 · 엔터로 누르는 길이 있습니다).
 *
 * ⚠ 여러 번 불려도 됩니다 — 청크는 모듈 캐시가, 목록은 `staleTime` 이 막습니다.
 */
function useWarm() {
  const queryClient = useQueryClient()

  return (to: string) => {
    void PAGE_CHUNK[to]?.()
    if (to !== ROUTES.MY_SHELF) return
    /*
      ⚠⚠ **진열대 목록은 청크와 따로 미리 받습니다.** 이 화면만 목록 하나에 병 수백 개를 받아
        벽을 세우는 곳이라, 청크만 와 있어도 화면이 스피너로 섭니다.
      ⚠⚠ **도메인은 `import()` 로 부릅니다 — 위에서 정적으로 import 하면 안 됩니다.**
        실측 (2026-09-18 빌드) : 정적 import 면 main **305.7KB** · main.css **93.9KB** 이고 진열대
        청크가 아예 없습니다. `import()` 면 main **266.2KB** · main.css **70.8KB** 이고 진열대가
        제 청크로 떨어집니다 (shelf 51.2KB + shelf.css 23.1KB — 메인 첫 진입은 그것을 안 받습니다).
      ⚠ 나머지 다섯은 청크만 받습니다 — 목록이 진열대만큼 무겁지 않아 최소 잔류(`HOLD_MIN_MS`
        0.42초) 안에 대개 들어옵니다. 어느 화면이 눈에 띄게 늦으면 그 화면만 여기에 더합니다.
    */
    void import('@/features/shelf').then(({ shelfItemsQuery }) =>
      queryClient.prefetchQuery(shelfItemsQuery()),
    )
  }
}

function PrimaryNav({ isLoggedIn, ink }: { isLoggedIn: boolean; ink: Ink }) {
  const items = NAV_ITEMS.filter((item) => isLoggedIn || !item.requiresAuth)
  const diveOut = useDiveOut()
  const warm = useWarm()

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
              onPointerEnter={() => warm(item.to)}
              onFocus={() => warm(item.to)}
              /* 메인에서 나갈 때만 잠수입니다 — 아니면 평소의 NavLink (위 `useDiveOut`) */
              onClick={diveOut(item.to)}
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
 * ⚠ 지금 화면은 **밑줄만** 긋고 굵게 하지 않습니다(2026-09-16 헤더 통일). 굵게 하면
 * 글자 폭이 늘어 정중앙에 선 메뉴 다섯 개가 화면마다 조금씩 옮겨 갑니다.
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
  /*
    후기 · 자유도 잠수 대상입니다 (2026-09-20). 주요 메뉴와 **같은 자리**를 씁니다 — 펼침
    메뉴라고 규칙이 다르면 같은 바다인데 어떤 문은 잠기고 어떤 문은 안 잠깁니다.
  */
  const diveOut = useDiveOut()
  const warm = useWarm()

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
                onPointerEnter={() => warm(item.to)}
                onFocus={() => warm(item.to)}
                onClick={(event) => {
                  /*
                    ⚠ 메뉴는 **어느 쪽이든 닫습니다.** 잠수로 가로채면 주소가 1.4초 뒤에
                      바뀌는데, 그때까지 열려 있으면 커튼 위에 메뉴가 남습니다.
                  */
                  setOpen(false)
                  diveOut(item.to)?.(event)
                }}
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

/** 계정 아이콘 ▾ — 개인 정보 수정 · 로그아웃 두 줄 */
function AccountMenu({ ink }: { ink: Ink }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const clear = useAuthStore((state) => state.clear)
  const { open, setOpen, containerRef } = useDismissable()

  /*
   * 스토어를 비우는 것만으로는 로그아웃이 아닙니다 — refresh 토큰은 httpOnly 쿠키라
   * 서버에 알려야 합니다. 실패해도 이 브라우저에서는 나가도록 `onSettled` 에서
   * 비우고, 캐시도 함께 비워야 다음 사람이 앞 사람 화면을 안 봅니다.
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

/** 드롭다운 공통 동작(바깥 클릭 · Esc). 헤더 안에서만 두 번 쓰여 여기 둡니다 */
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
