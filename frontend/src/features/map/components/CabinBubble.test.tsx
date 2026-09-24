import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { setBoatAnchorSource } from '../lib/boatAnchor'

import { CabinBubble } from './CabinBubble'

/*
 * 말풍선은 **배를 따라다니므로 배 자리가 없으면 안 보입니다** — 자리를 모르는 채로 그리면
 * 화면 왼쪽 위(0,0)에 찍히기 때문입니다. 그래서 테스트도 엔진 자리를 하나 꽂아 둡니다
 * (실제로는 `ScentScene` 이 엔진에 붙을 때 꽂습니다 · `lib/boatAnchor`).
 */
beforeEach(() => {
  setBoatAnchorSource(() => ({
    x: 400,
    y: 300,
    r: 50,
    ax: 430,
    ay: 300,
    side: 1,
    on: true,
  }))
})
afterEach(() => setBoatAnchorSource(null))

const renderCabin = (props: Partial<Parameters<typeof CabinBubble>[0]> = {}) =>
  render(
    <MemoryRouter>
      <CabinBubble open onClose={vi.fn()} isLoggedIn {...props} />
    </MemoryRouter>,
  )

describe('CabinBubble', () => {
  it('줄 둘이 진열대와 컬렉션 무대로 간다', () => {
    renderCabin()

    expect(screen.getByRole('link', { name: '진열대' })).toHaveAttribute(
      'href',
      '/shelf',
    )
    /*
      컬렉션 목록은 제 주소가 없어 진열대의 **하단 무대**로 갑니다 — 이 쿼리가 밖에서
      그 무대를 여는 유일한 구멍입니다 (`MyShelfPage` 의 `SHELF_STAGE_PARAM`).
    */
    expect(screen.getByRole('link', { name: '컬렉션' })).toHaveAttribute(
      'href',
      '/shelf?stage=collection',
    )
  })

  /*
    엔진은 이 Promise 로 **말풍선이 떠 있는가**를 셉니다 — 떠 있는 동안 3D 누름은 '고르기' 가
    아니라 '닫기' 입니다. 줄로 떠나는 길에서 안 알리면 엔진이 영영 떠 있는 줄 압니다.
  */
  it('줄을 고르면 떠나면서도 닫기를 알린다', async () => {
    const onClose = vi.fn()
    renderCabin({ onClose })

    await userEvent.click(screen.getByRole('link', { name: '컬렉션' }))

    expect(onClose).toHaveBeenCalledOnce()
  })

  /*
    닫기 단추가 없습니다 (정말 작은 말풍선입니다). 나가는 길은 Esc · 3D 누름 · 줄 고르기
    셋이고, 앞의 둘 중 Esc 만 이 컴포넌트 몫입니다 — 3D 누름은 엔진이 받아 화면에 알립니다.
  */
  it('Esc 를 누르면 닫기를 알린다', async () => {
    const onClose = vi.fn()
    renderCabin({ onClose })

    await userEvent.keyboard('{Escape}')

    expect(onClose).toHaveBeenCalledOnce()
  })

  it('닫혀 있으면 아무것도 그리지 않는다', () => {
    renderCabin({ open: false })

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  /*
    ⚠️ 자리를 모르면 **안 보입니다.** 이 칸은 화면 왼쪽 위(0,0)에 서 있다가 자리를 받아 옮겨
    가는데, 그 사이 한 장이라도 칠해지면 말풍선이 왼쪽 위에 찍히고 자라는 모습도 거기서
    시작합니다 (2026-09-21 사용자가 본 것). 첫 칠 전에 자리를 못 잡으면 차라리 숨깁니다.
  */
  it('배 자리를 모르면 그리기는 하되 보이지 않는다', () => {
    setBoatAnchorSource(null)
    renderCabin()

    expect(screen.getByRole('dialog', { hidden: true })).toHaveStyle({
      visibility: 'hidden',
    })
  })

  /*
    줄을 고르면 곧바로 옮겨 가지 않고 **선실로 들어가는 전환**을 부르는 쪽에 넘깁니다
    (`HomePage` → `DiveCurtain` 의 cabin). 전환이 덮은 **뒤에** 옮겨 가야 3D 가 사라진 자리가
    한 장도 안 비칩니다 — 그래서 누른 직후에는 아직 메인에 서 있어야 합니다.
  */
  describe('선실로 들어가기', () => {
    /** 지금 어느 주소에 서 있는지 시험이 볼 수 있게 적어 둡니다 */
    function Here() {
      const { pathname, search } = useLocation()
      return <div>{`지금: ${pathname}${search}`}</div>
    }

    const renderAtHome = (onEnter: (to: string) => void) =>
      render(
        <MemoryRouter initialEntries={['/']}>
          <CabinBubble open onClose={vi.fn()} isLoggedIn onEnter={onEnter} />
          <Routes>
            <Route path="*" element={<Here />} />
          </Routes>
        </MemoryRouter>,
      )

    it.each([
      ['진열대', '/shelf'],
      ['컬렉션', '/shelf?stage=collection'],
    ])('%s 를 고르면 옮겨 가지 않고 갈 곳을 넘긴다', async (name, to) => {
      const onEnter = vi.fn()
      renderAtHome(onEnter)

      await userEvent.click(screen.getByRole('link', { name }))

      expect(onEnter).toHaveBeenCalledWith(to)
      expect(screen.getByText('지금: /')).toBeInTheDocument()
    })

    it('Ctrl 을 쥐고 누르면 가로채지 않는다 — 새 탭으로 여는 누름이다', async () => {
      const user = userEvent.setup()
      const onEnter = vi.fn()
      renderAtHome(onEnter)

      await user.keyboard('{Control>}')
      await user.click(screen.getByRole('link', { name: '진열대' }))
      await user.keyboard('{/Control}')

      expect(onEnter).not.toHaveBeenCalled()
    })
  })

  describe('비로그인', () => {
    it('두 줄이 잠겨 눌리지 않고, 로그인으로 가는 길만 열려 있다', () => {
      renderCabin({ isLoggedIn: false })

      // 무엇이 들어 있는지는 그대로 보여 줍니다 — 말풍선을 안 띄우는 쪽이 아닙니다
      expect(screen.getByText('진열대')).toBeInTheDocument()
      expect(screen.getByText('컬렉션')).toBeInTheDocument()

      expect(
        screen.queryByRole('link', { name: '진열대' }),
      ).not.toBeInTheDocument()
      expect(
        screen.queryByRole('link', { name: '컬렉션' }),
      ).not.toBeInTheDocument()

      // 돌아올 자리(메인)를 달고 로그인으로 보냅니다
      expect(
        screen.getByRole('link', { name: '로그인이 필요합니다' }),
      ).toHaveAttribute('href', '/login?redirectTo=%2F')
    })
  })
})
