import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'

import {
  useGraphicsStore,
  type SceneQuality,
} from '@/shared/store/graphicsStore'

import { GraphicsMenu } from './GraphicsMenu'
import { inkOf } from './tone'

const integratedLow: SceneQuality = {
  mode: 'auto',
  tier: 'low',
  reason: 'start',
  gpuClass: 'integrated',
}

const renderMenu = () => render(<GraphicsMenu ink={inkOf('glass')} />)
const gear = () => screen.getByRole('button', { name: '그래픽 설정' })

afterEach(() => {
  useGraphicsStore.setState({ mode: 'auto', told: [], quality: null })
  localStorage.clear()
})

describe('GraphicsMenu', () => {
  it('톱니바퀴를 누르면 열리고, 다시 누르면 닫힙니다', async () => {
    const user = userEvent.setup()
    renderMenu()
    expect(gear()).toHaveAttribute('aria-expanded', 'false')

    await user.click(gear())
    expect(gear()).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('dialog', { name: '그래픽 품질' })).toBeVisible()

    await user.click(gear())
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('고른 것이 선택되어 있고, 다른 것을 고르면 그 단계로 고정합니다', async () => {
    const user = userEvent.setup()
    useGraphicsStore.setState({ mode: 'auto', quality: integratedLow })
    renderMenu()

    await user.click(gear())

    expect(screen.getByRole('radio', { name: /^자동/ })).toBeChecked()
    expect(screen.getByText('지금 낮음 · 내장 그래픽')).toBeVisible()

    await user.click(screen.getByRole('radio', { name: /^높음/ }))
    expect(useGraphicsStore.getState().mode).toBe('high')
    expect(screen.getByRole('radio', { name: /^높음/ })).toBeChecked()
  })

  it('내장 그래픽이면 Windows 고성능 설정을 알려 주고, 외장이면 알리지 않습니다', async () => {
    const user = userEvent.setup()
    useGraphicsStore.setState({ quality: integratedLow })
    renderMenu()
    await user.click(gear())
    expect(screen.getByText(/고성능/)).toBeVisible()

    act(() => {
      useGraphicsStore.setState({
        mode: 'high',
        quality: {
          ...integratedLow,
          mode: 'high',
          tier: 'high',
          gpuClass: 'discrete',
        },
      })
    })
    expect(screen.queryByText(/고성능/)).not.toBeInTheDocument()
  })

  it('엔진이 붙기 전(메인 밖)이면 지금 단계 없이 설명만 섭니다', async () => {
    const user = userEvent.setup()
    renderMenu()

    await user.click(gear())

    expect(screen.getByText('기기에 맞춰 알아서 맞춥니다')).toBeVisible()
    expect(screen.queryByText(/^지금/)).not.toBeInTheDocument()
  })

  it('Esc 로 닫고 포커스를 톱니바퀴로 돌려줍니다', async () => {
    const user = userEvent.setup()
    renderMenu()

    await user.click(gear())
    await user.keyboard('{Escape}')

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(gear()).toHaveFocus()
  })

  /* 3D 는 iframe 이라 그 누름이 이 문서로 오지 않고, 창이 포커스를 잃는 것으로 옵니다 */
  it('3D 를 누르면(창이 포커스를 잃으면) 닫힙니다', async () => {
    const user = userEvent.setup()
    renderMenu()

    await user.click(gear())
    fireEvent.blur(window)

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
