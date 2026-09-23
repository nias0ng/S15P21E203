import { render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { WaterCaustics } from '@/shared/ui/WaterCaustics'

describe('WaterCaustics', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('WebGL 을 못 쓰면 아무것도 그리지 않고 비켜선다', () => {
    const getContext = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue(null)

    const { container } = render(<WaterCaustics />)

    expect(getContext).toHaveBeenCalled()
    expect(container.querySelector('canvas')).toBeNull()
  })

  it('장식이라 보조 기술에는 드러나지 않는다', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)

    const { container } = render(<WaterCaustics />)

    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true')
  })
})
