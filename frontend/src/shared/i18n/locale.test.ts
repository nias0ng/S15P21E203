import { describe, expect, it } from 'vitest'

import { detectLocale, isLocale, localizedBrand, localizedName } from './locale'

describe('detectLocale', () => {
  it('가장 앞에 둔 언어가 한국어면 한국어로 시작한다', () => {
    expect(detectLocale(['ko-KR', 'en-US'])).toBe('ko')
    expect(detectLocale(['ko'])).toBe('ko')
  })

  it('한국어를 뒤에 둔 사람은 영어로 시작한다', () => {
    expect(detectLocale(['en-US', 'ko-KR'])).toBe('en')
    expect(detectLocale(['ja-JP'])).toBe('en')
  })

  it('브라우저가 언어를 알려 주지 않으면 한국어로 시작한다', () => {
    expect(detectLocale([])).toBe('ko')
    expect(detectLocale([''])).toBe('ko')
  })
})

describe('isLocale', () => {
  it('ko · en 만 받는다', () => {
    expect(isLocale('ko')).toBe(true)
    expect(isLocale('en')).toBe(true)
    expect(isLocale('ja')).toBe(false)
    expect(isLocale(undefined)).toBe(false)
  })
})

describe('localizedName', () => {
  it('영어 화면은 원래 이름을 쓴다', () => {
    expect(localizedName('en', 'Bleu de Chanel', '블루 드 샤넬')).toBe(
      'Bleu de Chanel',
    )
  })

  it('한국어 화면은 한국어 이름을 쓰고, 없으면 원래 이름을 쓴다', () => {
    expect(localizedName('ko', 'Bleu de Chanel', '블루 드 샤넬')).toBe(
      '블루 드 샤넬',
    )
    expect(localizedName('ko', 'Bleu de Chanel', null)).toBe('Bleu de Chanel')
    expect(localizedName('ko', 'Bleu de Chanel', '  ')).toBe('Bleu de Chanel')
  })
})

describe('localizedBrand', () => {
  it('원래 이름이 있으면 localizedName 과 같다', () => {
    expect(localizedBrand('en', 'Chanel', '샤넬')).toBe('Chanel')
    expect(localizedBrand('ko', 'Chanel', '샤넬')).toBe('샤넬')
    expect(localizedBrand('ko', 'Chanel', undefined)).toBe('Chanel')
  })

  it('원래 이름이 비면 한국어 이름을, 둘 다 비면 null 이다', () => {
    expect(localizedBrand('en', null, '샤넬')).toBe('샤넬')
    expect(localizedBrand('ko', null, null)).toBeNull()
    expect(localizedBrand('en', undefined, ' ')).toBeNull()
  })
})
