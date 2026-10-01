import 'i18next'

import type { ko } from './resources'

// 한국어 묶음의 모양이 곧 `t()` 키의 타입입니다. 없는 키를 부르면 타입 검사에서 걸립니다.
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common'
    resources: typeof ko
  }
}
