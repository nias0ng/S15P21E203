import { act, render, renderHook, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

/*
  `CAN_MEASURE` 는 모듈을 읽을 때 한 번 정해집니다. jsdom 에는 ResizeObserver 가 없어,
  재는 쪽을 볼 때는 가짜를 먼저 깔고 모듈을 새로 읽습니다.
*/
class FakeResizeObserver {
  static instances: FakeResizeObserver[] = []
  readonly observed: Element[] = []
  readonly callback: () => void
  disconnected = false

  constructor(callback: () => void) {
    this.callback = callback
    FakeResizeObserver.instances.push(this)
  }

  observe(element: Element) {
    this.observed.push(element)
  }

  disconnect() {
    this.disconnected = true
  }

  /** 브라우저가 크기 바뀜을 알린 척합니다 */
  fire() {
    this.callback()
  }
}

async function loadWithObserver() {
  FakeResizeObserver.instances = []
  vi.stubGlobal('ResizeObserver', FakeResizeObserver)
  vi.resetModules()
  return import('./useMeasuredHeight')
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  vi.resetModules()
})

describe('useMeasuredHeight', () => {
  it('잴 수 없는 환경에서는 처음 값 그대로 둔다', async () => {
    const { CAN_MEASURE, useMeasuredHeight } =
      await import('./useMeasuredHeight')

    expect(CAN_MEASURE).toBe(false)
    expect(renderHook(() => useMeasuredHeight()).result.current.height).toBe(0)
    expect(
      renderHook(() => useMeasuredHeight(null)).result.current.height,
    ).toBeNull()
  })

  it('크기가 바뀔 때마다 높이를 올림해 다시 잰다', async () => {
    const { useMeasuredHeight } = await loadWithObserver()
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      height: 118.2,
    } as DOMRect)

    function Paper() {
      const { ref, height } = useMeasuredHeight(null)
      return (
        <div ref={ref} data-testid="paper">
          {height === null ? '재기 전' : `${height}px`}
        </div>
      )
    }
    render(<Paper />)
    expect(screen.getByTestId('paper')).toHaveTextContent('재기 전')

    const [observer] = FakeResizeObserver.instances
    expect(observer?.observed).toEqual([screen.getByTestId('paper')])

    act(() => observer?.fire())

    expect(screen.getByTestId('paper')).toHaveTextContent('119px')
  })

  it('사라지면 재기를 멈춘다', async () => {
    const { useMeasuredHeight } = await loadWithObserver()

    function Paper() {
      const { ref } = useMeasuredHeight()
      return <div ref={ref} />
    }
    const { unmount } = render(<Paper />)

    unmount()

    expect(FakeResizeObserver.instances[0]?.disconnected).toBe(true)
  })
})
