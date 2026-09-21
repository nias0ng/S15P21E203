import { lazy, Suspense } from 'react'
import { createBrowserRouter } from 'react-router'

import { RootLayout, type PageWidth } from '@/app/layouts/RootLayout'
import { ErrorPage } from '@/pages/ErrorPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { ROUTES } from '@/shared/config/routes'
import { PageFallback } from '@/shared/ui/PageFallback'

// 라우트 단위 코드 스플리팅: 첫 진입 번들을 가볍게 유지합니다.
// 오른쪽 주석은 와이어프레임 화면 번호 · 담당 에픽입니다.
const HomePage = lazy(() => import('@/pages/HomePage')) // A01  · 109 (A06 자연어 추천은 이 화면의 모달입니다)

const PerfumeListPage = lazy(() => import('@/pages/PerfumeListPage')) // A33  · 110
const PerfumeSearchPage = lazy(() => import('@/pages/PerfumeSearchPage')) // A09  · 110
const PerfumeDetailPage = lazy(() => import('@/pages/PerfumeDetailPage')) // A10  · 110
const ReviewDetailPage = lazy(() => import('@/pages/ReviewDetailPage')) // A12  · 110

const BrandListPage = lazy(() => import('@/pages/BrandListPage')) // A34  · 111
const BrandDetailPage = lazy(() => import('@/pages/BrandDetailPage')) // 신규 · 111
const NoteListPage = lazy(() => import('@/pages/NoteListPage')) // A35  · 112
const NoteDetailPage = lazy(() => import('@/pages/NoteDetailPage')) // A36  · 112

// ⚠️ 임시 경로. 회원가입이 동작하면 가입 직후 온보딩 스텝으로 옮기고 이 줄을 지웁니다.
const TasteTestPage = lazy(() => import('@/pages/TasteTestPage')) // TST-03

const MyShelfPage = lazy(() => import('@/pages/MyShelfPage')) // A13  · 113
const CollectionDetailPage = lazy(() => import('@/pages/CollectionDetailPage')) // A17  · 113

const ReviewBoardPage = lazy(() => import('@/pages/ReviewBoardPage')) // A22a · 114
const FreeBoardPage = lazy(() => import('@/pages/FreeBoardPage')) // A22b · 114
const PostDetailPage = lazy(() => import('@/pages/PostDetailPage')) // A23  · 114
const ReviewWritePage = lazy(() => import('@/pages/ReviewWritePage')) // A24a · 114
const PostWritePage = lazy(() => import('@/pages/PostWritePage')) // A24b · 114

const LoginPage = lazy(() => import('@/pages/LoginPage')) // A28  · 115
const SignupPage = lazy(() => import('@/pages/SignupPage')) // A28  · 115
const PasswordResetPage = lazy(() => import('@/pages/PasswordResetPage')) // A31  · 115
const AccountPage = lazy(() => import('@/pages/AccountPage')) // A29  · 115

const withSuspense = (element: React.ReactNode) => (
  <Suspense fallback={<PageFallback />}>{element}</Suspense>
)

/*
 * 화면이 쓰는 본문 폭(RootLayout 의 PageWidth). 적지 않은 화면은 wide(1440)입니다.
 *   FULL  화면 전체를 그림으로 쓰는 곳 — 향 지도 · 진열대
 *   TEXT  글을 읽고 쓰는 곳 · 계정 폼 — 한 줄이 너무 길어지지 않게 800 으로 가둡니다
 */
const FULL = { width: 'full' } satisfies { width: PageWidth }
const TEXT = { width: 'text' } satisfies { width: PageWidth }
/**
 * 어두운 방 + 유리판 화면. 폭은 적지 않습니다 — 모두 기본 wide(1440)입니다.
 * docs/어두운-방-유리판.md
 */
const NIGHT = { night: true } satisfies { night: boolean }
/**
 * 어두운 방 + 글 읽고 쓰는 폭 (A12 · A23 · A24a · A24b). 게시판에서 **한 번에
 * 넘어가는 사이**라 같은 어둠입니다 — docs/어두운-방-유리판.md
 */
const TEXT_NIGHT = { width: 'text', night: true } satisfies {
  width: PageWidth
  night: boolean
}
/** 헤더 아래 화면 끝까지 — 3D 향 지도(A01)가 씁니다 */
const BLEED = { width: 'bleed' } satisfies { width: PageWidth }

export const router = createBrowserRouter([
  {
    path: ROUTES.HOME,
    element: <RootLayout />,
    errorElement: <ErrorPage />,
    children: [
      { index: true, element: withSuspense(<HomePage />), handle: BLEED },

      {
        path: ROUTES.PERFUMES,
        element: withSuspense(<PerfumeListPage />),
        handle: NIGHT,
      },
      {
        path: ROUTES.PERFUME_SEARCH,
        element: withSuspense(<PerfumeSearchPage />),
        handle: NIGHT,
      },
      {
        path: ROUTES.PERFUME_DETAIL,
        element: withSuspense(<PerfumeDetailPage />),
        handle: NIGHT,
      },
      {
        path: ROUTES.REVIEW_DETAIL,
        element: withSuspense(<ReviewDetailPage />),
        handle: TEXT_NIGHT,
      },

      {
        path: ROUTES.BRANDS,
        element: withSuspense(<BrandListPage />),
        handle: NIGHT,
      },
      {
        path: ROUTES.BRAND_DETAIL,
        element: withSuspense(<BrandDetailPage />),
        handle: NIGHT,
      },
      {
        path: ROUTES.NOTES,
        element: withSuspense(<NoteListPage />),
        handle: NIGHT,
      },
      {
        path: ROUTES.NOTE_DETAIL,
        element: withSuspense(<NoteDetailPage />),
        handle: NIGHT,
      },

      { path: ROUTES.TASTE_TEST, element: withSuspense(<TasteTestPage />) },

      {
        path: ROUTES.MY_SHELF,
        element: withSuspense(<MyShelfPage />),
        handle: FULL,
      },
      {
        path: ROUTES.COLLECTION_DETAIL,
        element: withSuspense(<CollectionDetailPage />),
      },

      {
        path: ROUTES.COMMUNITY_REVIEWS,
        element: withSuspense(<ReviewBoardPage />),
        handle: NIGHT,
      },
      {
        path: ROUTES.COMMUNITY_FREE,
        element: withSuspense(<FreeBoardPage />),
        handle: NIGHT,
      },
      {
        path: ROUTES.POST_DETAIL,
        element: withSuspense(<PostDetailPage />),
        handle: TEXT_NIGHT,
      },
      {
        path: ROUTES.REVIEW_WRITE,
        element: withSuspense(<ReviewWritePage />),
        handle: TEXT_NIGHT,
      },
      {
        // 수정도 같은 화면입니다 — 주소로 모드를 가릅니다
        path: ROUTES.REVIEW_EDIT,
        element: withSuspense(<ReviewWritePage />),
        handle: TEXT_NIGHT,
      },
      {
        path: ROUTES.POST_WRITE,
        element: withSuspense(<PostWritePage />),
        handle: TEXT_NIGHT,
      },
      {
        // 수정도 같은 화면입니다 — 주소로 모드를 가릅니다
        path: ROUTES.POST_EDIT,
        element: withSuspense(<PostWritePage />),
        handle: TEXT_NIGHT,
      },

      {
        path: ROUTES.LOGIN,
        element: withSuspense(<LoginPage />),
        handle: TEXT_NIGHT,
      },
      {
        path: ROUTES.SIGNUP,
        element: withSuspense(<SignupPage />),
        handle: TEXT_NIGHT,
      },
      {
        path: ROUTES.PASSWORD_RESET,
        element: withSuspense(<PasswordResetPage />),
        handle: TEXT_NIGHT,
      },
      {
        path: ROUTES.ACCOUNT,
        element: withSuspense(<AccountPage />),
        handle: TEXT,
      },

      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
