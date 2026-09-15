import { describe, expect, it } from 'vitest'

import {
  SCENT_FAMILY_KEYS,
  SCENT_FAMILY_NAMES,
  isScentFamilyKey,
  scentFamilyName,
  toScentFamilyKey,
} from './scentFamilies'

/**
 * 이 어휘는 백엔드 `scent_regions.code` 와 3D 엔진의 `scent_map.json` 이 함께 쓰는
 * 값입니다. 한쪽만 바뀌면 조용히 어긋나므로 개수와 이름표를 여기서 못박습니다.
 */
describe('향 계열 공용 어휘', () => {
  it('아홉 개다', () => {
    expect(SCENT_FAMILY_KEYS).toHaveLength(9)
  })

  it('키마다 이름이 있다', () => {
    for (const key of SCENT_FAMILY_KEYS) {
      expect(SCENT_FAMILY_NAMES[key]).toBeTruthy()
    }
  })

  it('백엔드가 V6 에서 줄인 짧은 코드를 쓴다', () => {
    // 긴 이름(GREEN_AROMATIC · AMBER_SPICY · MUSK_POWDERY)은 더 오지 않습니다
    expect(isScentFamilyKey('GREEN')).toBe(true)
    expect(isScentFamilyKey('GREEN_AROMATIC')).toBe(false)
  })

  it('모르는 값은 버리지 않고 null 로 바꾼다', () => {
    expect(toScentFamilyKey('ORIENTAL')).toBeNull()
    expect(toScentFamilyKey(null)).toBeNull()
    expect(toScentFamilyKey('WOODY')).toBe('WOODY')
  })

  it('모르는 값의 이름은 undefined 가 아니라 null 이다', () => {
    expect(scentFamilyName('FOUGERE')).toBeNull()
    expect(scentFamilyName('FLORAL')).toBe('플로럴')
  })
})
