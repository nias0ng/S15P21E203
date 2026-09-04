import { lazy, Suspense } from 'react'
import { createBrowserRouter } from 'react-router'

import { RootLayout } from '@/app/layouts/RootLayout'
import { ErrorPage } from '@/pages/ErrorPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { ROUTES } from '@/shared/config/routes'
import { PageFallback } from '@/shared/ui/PageFallback'

// 라우트 단위 코드 스플리팅: 첫 진입 번들을 가볍게 유지합니다.
const HomePage = lazy(() => import('@/pages/HomePage'))
const MapPage = lazy(() => import('@/pages/MapPage'))
const PerfumeDetailPage = lazy(() => import('@/pages/PerfumeDetailPage'))
const RecommendPage = lazy(() => import('@/pages/RecommendPage'))
const CommunityPage = lazy(() => import('@/pages/CommunityPage'))
const MyShelfPage = lazy(() => import('@/pages/MyShelfPage'))
const LoginPage = lazy(() => import('@/pages/LoginPage'))

const withSuspense = (element: React.ReactNode) => (
  <Suspense fallback={<PageFallback />}>{element}</Suspense>
)

export const router = createBrowserRouter([
  {
    path: ROUTES.HOME,
    element: <RootLayout />,
    errorElement: <ErrorPage />,
    children: [
      { index: true, element: withSuspense(<HomePage />) },
      { path: ROUTES.MAP, element: withSuspense(<MapPage />) },
      {
        path: ROUTES.PERFUME_DETAIL,
        element: withSuspense(<PerfumeDetailPage />),
      },
      { path: ROUTES.RECOMMEND, element: withSuspense(<RecommendPage />) },
      { path: ROUTES.COMMUNITY, element: withSuspense(<CommunityPage />) },
      { path: ROUTES.MY_SHELF, element: withSuspense(<MyShelfPage />) },
      { path: ROUTES.LOGIN, element: withSuspense(<LoginPage />) },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
