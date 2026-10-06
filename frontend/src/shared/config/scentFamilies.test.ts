import { describe, expect, it } from 'vitest'

import { useLocaleStore } from '@/shared/store/localeStore'

import {
  SCENT_FAMILY_KEYS,
  SCENT_FAMILY_NAMES,
  isScentFamilyKey,
  scentFamilyName,
  toScentFamilyKey,
} from './scentFamilies'

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

  it('이름은 읽을 때의 화면 언어를 따른다', () => {
    const names = SCENT_FAMILY_NAMES
    expect(names.MUSK).toBe('머스크')

    useLocaleStore.getState().setLocale('en')

    expect(names.MUSK).toBe('Musk')
    expect(scentFamilyName('FLORAL')).toBe('Floral')
  })
})
