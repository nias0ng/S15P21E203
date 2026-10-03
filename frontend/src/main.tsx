import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { AppProviders } from '@/app/providers/AppProviders'
// 번역을 첫 렌더보다 먼저 켭니다
import '@/shared/i18n'

import './styles/index.css'
// 어두운 방 · 유리판 (향수 목록 · 브랜드 공용). 두 도메인이 쓰므로 여기서 한 번만 싣습니다
import './styles/scent-display.css'

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error(
    '#root 엘리먼트를 찾을 수 없습니다. index.html 을 확인하세요.',
  )
}

createRoot(rootElement).render(
  <StrictMode>
    <AppProviders />
  </StrictMode>,
)
