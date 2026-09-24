import { describe, expect, it } from 'vitest'

import cabinStyle from '@/shared/ui/cabin-curtain.css?raw'

import rootHtml from '../../../index.html?raw'

import bootStyle from './scene-boot.css?raw'

/**
 * 메인에 들어올 때의 구름 — **세 곳이 한 벌**입니다.
 *
 *   `index.html` 의 `#boot`   첫 진입 (React 전 · 정적 첫 칠)
 *   `scene-boot.css`          앱 안에서 메인에 다시 들어올 때
 *   `cabin-curtain.css`       메인에서 진열대로 갈 때 덮이는 구름 (선실로 들어가기)
 *
 * 첫 칠은 앱 CSS 가 오기 전이고 로딩 커튼의 변수는 `.scene-boot` 안에만 있어서, 토큰 하나로 묶지
 * 못하고 값을 옮겨 적었습니다. 한 곳만 고치면 메인에 들어올 때와 진열대로 갈 때 구름이 조용히
 * 다른 색이 됩니다 — 둘 다 화면으로는 따로따로만 보이는 자리라 여기서 잡습니다.
 *
 * NOTE: 색이 **무엇인지**는 안 봅니다. 그건 화면으로 정할 값이고, 여기는 셋이 같은가만 봅니다.
 */
describe('메인의 구름', () => {
  /*
    CSS · HTML 은 내보내는 것이 없어 원문(`?raw`)에서 찾습니다. 줄머리에 선언된 것만 집습니다 —
    이 파일들은 주석에도 같은 이름을 적어 두어서, 느슨하게 찾으면 주석을 뭅니다.
  */
  const pick = (source: string, name: string) => {
    const found = new RegExp(`^\\s*${name}:\\s*([^;]+);`, 'm').exec(source)
    if (!found?.[1]) throw new Error(`${name} 를 못 찾았다`)
    return found[1].trim().toLowerCase().replace(/\s+/g, ' ')
  }

  it('바탕색이 세 곳에서 같다', () => {
    const boot = pick(bootStyle, '--boot-bg')
    expect(pick(rootHtml, '--boot-bg')).toBe(boot)
    expect(pick(cabinStyle, '--cabin-veil')).toBe(boot)
  })

  it('구름 결의 색이 세 곳에서 같다', () => {
    const boot = pick(bootStyle, '--boot-cloud')
    expect(pick(rootHtml, '--boot-cloud')).toBe(boot)
    expect(pick(cabinStyle, '--cabin-cloud')).toBe(boot)
  })
})
