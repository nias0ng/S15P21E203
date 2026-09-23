import { lazy, Suspense } from 'react'
import { createBrowserRouter } from 'react-router'

import { RootLayout, type PageWidth } from '@/app/layouts/RootLayout'
import { ErrorPage } from '@/pages/ErrorPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { ROUTES } from '@/shared/config/routes'
import { PageFallback } from '@/shared/ui/PageFallback'

const HomePage = lazy(() => import('@/pages/HomePage'))

const PerfumeListPage = lazy(() => import('@/pages/PerfumeListPage'))
const PerfumeDetailPage = lazy(() => import('@/pages/PerfumeDetailPage'))
const ReviewDetailPage = lazy(() => import('@/pages/ReviewDetailPage'))

const BrandListPage = lazy(() => import('@/pages/BrandListPage'))
const BrandDetailPage = lazy(() => import('@/pages/BrandDetailPage'))
const NoteListPage = lazy(() => import('@/pages/NoteListPage'))
const NoteDetailPage = lazy(() => import('@/pages/NoteDetailPage'))

// 첫 로그인이면 LoginPage 가 여기로 보냅니다 — 가입 응답에 토큰이 없어 가입 직후에는 못 띄웁니다
const TasteTestPage = lazy(() => import('@/pages/TasteTestPage'))

const MyShelfPage = lazy(() => import('@/pages/MyShelfPage'))
const CollectionDetailPage = lazy(() => import('@/pages/CollectionDetailPage'))

const ReviewBoardPage = lazy(() => import('@/pages/ReviewBoardPage'))
const FreeBoardPage = lazy(() => import('@/pages/FreeBoardPage'))
const PostDetailPage = lazy(() => import('@/pages/PostDetailPage'))
const ReviewWritePage = lazy(() => import('@/pages/ReviewWritePage'))
const PostWritePage = lazy(() => import('@/pages/PostWritePage'))

const LoginPage = lazy(() => import('@/pages/LoginPage'))
const SignupPage = lazy(() => import('@/pages/SignupPage'))
const PasswordResetPage = lazy(() => import('@/pages/PasswordResetPage'))
const AccountPage = lazy(() => import('@/pages/AccountPage'))

const withSuspense = (element: React.ReactNode) => (
  <Suspense fallback={<PageFallback />}>{element}</Suspense>
)

const FULL = { width: 'full' } satisfies { width: PageWidth }
/** 어두운 방 + 유리판 — docs/어두운-방-유리판.md */
const NIGHT = { night: true } satisfies { night: boolean }
/** 어두운 방 + 글 읽고 쓰는 폭 — 게시판에서 한 번에 넘어가는 사이라 같은 어둠입니다 */
const TEXT_NIGHT = { width: 'text', night: true } satisfies {
  width: PageWidth
  night: boolean
}
/** 어두운 방 + 물결 — 향수 · 브랜드 · 노트 · 커뮤니티 (S15P21E203-427) */
const WATER = { night: true, caustics: true } satisfies {
  night: boolean
  caustics: boolean
}
const TEXT_WATER = { width: 'text', night: true, caustics: true } satisfies {
  width: PageWidth
  night: boolean
  caustics: boolean
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
        handle: WATER,
      },
      {
        path: ROUTES.PERFUME_DETAIL,
        element: withSuspense(<PerfumeDetailPage />),
        handle: WATER,
      },
      {
        path: ROUTES.REVIEW_DETAIL,
        element: withSuspense(<ReviewDetailPage />),
        handle: TEXT_WATER,
      },

      {
        path: ROUTES.BRANDS,
        element: withSuspense(<BrandListPage />),
        handle: WATER,
      },
      {
        path: ROUTES.BRAND_DETAIL,
        element: withSuspense(<BrandDetailPage />),
        handle: WATER,
      },
      {
        path: ROUTES.NOTES,
        element: withSuspense(<NoteListPage />),
        handle: WATER,
      },
      {
        path: ROUTES.NOTE_DETAIL,
        element: withSuspense(<NoteDetailPage />),
        handle: WATER,
      },

      {
        path: ROUTES.TASTE_TEST,
        element: withSuspense(<TasteTestPage />),
        handle: NIGHT,
      },

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
        handle: WATER,
      },
      {
        path: ROUTES.COMMUNITY_FREE,
        element: withSuspense(<FreeBoardPage />),
        handle: WATER,
      },
      {
        path: ROUTES.POST_DETAIL,
        element: withSuspense(<PostDetailPage />),
        handle: TEXT_WATER,
      },
      {
        path: ROUTES.REVIEW_WRITE,
        element: withSuspense(<ReviewWritePage />),
        handle: TEXT_WATER,
      },
      {
        path: ROUTES.REVIEW_EDIT,
        element: withSuspense(<ReviewWritePage />),
        handle: TEXT_WATER,
      },
      {
        path: ROUTES.POST_WRITE,
        element: withSuspense(<PostWritePage />),
        handle: TEXT_WATER,
      },
      {
        path: ROUTES.POST_EDIT,
        element: withSuspense(<PostWritePage />),
        handle: TEXT_WATER,
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
        handle: TEXT_NIGHT,
      },

      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
