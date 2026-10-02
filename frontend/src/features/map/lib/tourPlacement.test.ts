import { describe, expect, it } from 'vitest'

import { placeTourTip } from './tourPlacement'

const area = { w: 1920, h: 990 }
const tip = { w: 380, h: 100 }
const box = (x: number, y: number, w = 80, h = 20, side = 1) => ({
  x,
  y,
  w,
  h,
  side,
})

describe('placeTourTip', () => {
  it('위에 서면 상자 가운데 위로 간격을 두고 선다', () => {
    expect(placeTourTip(box(900, 500), tip, area, 'above')).toEqual({
      x: 900 + 40 - 190,
      y: 500 - 10 - 100,
    })
  })

  it('위에 자리가 없으면 아래로 내려선다', () => {
    expect(placeTourTip(box(900, 40), tip, area, 'above').y).toBe(40 + 20 + 10)
  })

  it('아래에 자리가 없으면 위로 올라선다 — 화면 아래에 뜬 카드', () => {
    const card = box(400, 500, 320, 440)
    expect(placeTourTip(card, tip, area, 'below').y).toBe(500 - 10 - 100)
  })

  it('미니맵은 오른끝을 맞춘다', () => {
    const minimap = box(1660, 810, 230, 240)
    expect(placeTourTip(minimap, tip, area, 'aboveEnd').x).toBe(
      1660 + 230 - 380,
    )
  })

  it('배는 옆구리에 붙고, 배가 오른끝이면 왼쪽으로 선다', () => {
    const right = box(1000, 500, 0, 80, 1)
    const left = box(1000, 500, 0, 80, -1)

    expect(placeTourTip(right, tip, area, 'side')).toEqual({ x: 1000, y: 490 })
    expect(placeTourTip(left, tip, area, 'side').x).toBe(1000 - 380)
  })

  it('판 밖으로 나가지 않는다', () => {
    expect(placeTourTip(box(20, 600), tip, area, 'above').x).toBe(12)
    expect(placeTourTip(box(1880, 600), tip, area, 'above').x).toBe(
      1920 - 12 - 380,
    )
  })
})
