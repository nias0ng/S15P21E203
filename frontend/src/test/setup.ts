import '@testing-library/jest-dom/vitest'

import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// 각 테스트가 끝나면 렌더한 DOM 을 정리합니다.
// 안 하면 앞 테스트의 화면이 남아서 getByRole 이 "여러 개 찾았다"로 실패합니다.
afterEach(() => {
  cleanup()
})
