import { lazy, Suspense } from 'react'
import { createBrowserRouter } from 'react-router'

import { RootLayout, type PageWidth } from '@/app/layouts/RootLayout'
import { ErrorPage } from '@/pages/ErrorPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { ROUTES } from '@/shared/config/routes'
import { PageFallback } from '@/shared/ui/PageFallback'

// 라우트 단위 코드 스플리팅: 첫 진입 번들을 가볍게 유지합니다.
// 오른쪽 주석은 와이어프레임 화면 번호 · 담당 에픽입니다.
const HomePage = lazy(() => import('@/pages/HomePage')) // A01  · 109
const RecommendPage = lazy(() => import('@/pages/RecommendPage')) // A06  · 109

const PerfumeListPage = lazy(() => import('@/pages/PerfumeListPage')) // A33  · 110
const PerfumeSearchPage = lazy(() => import('@/pages/PerfumeSearchPage')) // A09  · 110
const PerfumeDetailPage = lazy(() => import('@/pages/PerfumeDetailPage')) // A10  · 110
const ReviewDetailPage = lazy(() => import('@/pages/ReviewDetailPage')) // A12  · 110

const BrandListPage = lazy(() => import('@/pages/BrandListPage')) // A34  · 111
const BrandDetailPage = lazy(() => import('@/pages/BrandDetailPage')) // 신규 · 111
const NoteListPage = lazy(() => import('@/pages/NoteListPage')) // A35  · 112
const NoteDetailPage = lazy(() => import('@/pages/NoteDetailPage')) // A36  · 112

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

export const router = createBrowserRouter([
  {
    path: ROUTES.HOME,
    element: <RootLayout />,
    errorElement: <ErrorPage />,
    children: [
      { index: true, element: withSuspense(<HomePage />), handle: FULL },
      {
        path: ROUTES.RECOMMEND,
        element: withSuspense(<RecommendPage />),
        handle: FULL,
      },

      { path: ROUTES.PERFUMES, element: withSuspense(<PerfumeListPage />) },
      {
        path: ROUTES.PERFUME_SEARCH,
        element: withSuspense(<PerfumeSearchPage />),
      },
      {
        path: ROUTES.PERFUME_DETAIL,
        element: withSuspense(<PerfumeDetailPage />),
      },
      {
        path: ROUTES.REVIEW_DETAIL,
        element: withSuspense(<ReviewDetailPage />),
        handle: TEXT,
      },

      { path: ROUTES.BRANDS, element: withSuspense(<BrandListPage />) },
      {
        path: ROUTES.BRAND_DETAIL,
        element: withSuspense(<BrandDetailPage />),
      },
      { path: ROUTES.NOTES, element: withSuspense(<NoteListPage />) },
      { path: ROUTES.NOTE_DETAIL, element: withSuspense(<NoteDetailPage />) },

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
      },
      { path: ROUTES.COMMUNITY_FREE, element: withSuspense(<FreeBoardPage />) },
      {
        path: ROUTES.POST_DETAIL,
        element: withSuspense(<PostDetailPage />),
        handle: TEXT,
      },
      {
        path: ROUTES.REVIEW_WRITE,
        element: withSuspense(<ReviewWritePage />),
        handle: TEXT,
      },
      {
        path: ROUTES.POST_WRITE,
        element: withSuspense(<PostWritePage />),
        handle: TEXT,
      },

      {
        path: ROUTES.LOGIN,
        element: withSuspense(<LoginPage />),
        handle: TEXT,
      },
      {
        path: ROUTES.SIGNUP,
        element: withSuspense(<SignupPage />),
        handle: TEXT,
      },
      {
        path: ROUTES.PASSWORD_RESET,
        element: withSuspense(<PasswordResetPage />),
        handle: TEXT,
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
