import '@testing-library/jest-dom/vitest'

import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach } from 'vitest'

import { i18n } from '@/shared/i18n'
import { useLocaleStore } from '@/shared/store/localeStore'

// 테스트는 한국어 화면으로 돕니다. jsdom 의 브라우저 언어가 en-US 라 그대로 두면 첫 방문
// 규칙으로 영어가 골라져, 한국어 문구로 찾는 테스트가 모두 실패합니다.
// 영어 화면을 보는 테스트는 그 안에서 `useLocaleStore.getState().setLocale('en')` 을 부릅니다.
beforeEach(async () => {
  useLocaleStore.setState({ locale: 'ko' })
  await i18n.changeLanguage('ko')
})

// 각 테스트가 끝나면 렌더한 DOM 을 정리합니다.
// 안 하면 앞 테스트의 화면이 남아서 getByRole 이 "여러 개 찾았다"로 실패합니다.
afterEach(() => {
  cleanup()
})

// jsdom 은 <dialog> 의 showModal() · close() 를 구현하지 않습니다.
// shared/ui/Modal 이 이 둘을 호출하므로, 폴리필이 없으면 Modal 을 쓰는 컴포넌트를
// 하나도 테스트할 수 없습니다(현재 11개 파일).
//
// 열림 여부만 흉내 냅니다. 브라우저가 해주는 배경 스크롤 잠금 · 포커스 가두기 ·
// 배경(backdrop)은 재현하지 않으므로, 그 동작은 테스트로 검증하지 마세요.
if (!HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal(
    this: HTMLDialogElement,
  ) {
    this.open = true
  }
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.open = false
    // Modal 이 dialog 의 close 이벤트로 부모에게 닫힘을 알립니다
    this.dispatchEvent(new Event('close'))
  }
}
