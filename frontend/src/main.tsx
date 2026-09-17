import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { AppProviders } from '@/app/providers/AppProviders'

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
