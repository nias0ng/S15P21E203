import { useEffect, useRef } from 'react'
import {
  Color,
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  Vector2,
  WebGLRenderer,
} from 'three'

import { cn } from '@/shared/lib/cn'
import {
  CAUSTICS,
  causticsFragment,
  causticsVertex,
} from '@/shared/ui/causticsShader'

/** 물결이 느려 초당 30장이면 충분합니다. 144Hz 화면에서 144장을 그리지 않게 묶습니다 */
const FRAME_MS = 1000 / 30
/** 빛줄기가 원래 번져 있어, 3/4 크기로 그려 늘려도 티가 나지 않습니다 */
const RENDER_SCALE = 0.75
/** 겹이 깔리고 걷히는 빠르기(시간 상수). 세 배쯤 지나면 거의 다 따라갑니다 */
const LAYER_EASE_MS = 400

/** 겹 수(0 ~ 2) → 옅은 겹 · 진한 겹의 세기. 옅은 겹이 먼저 깔리고 나중에 걷힙니다 */
const fineOf = (layers: number) => Math.min(Math.max(layers, 0), 1)
const wideOf = (layers: number) => Math.min(Math.max(layers - 1, 0), 1)

const CONTEXT = {
  alpha: true,
  premultipliedAlpha: true,
  antialias: false,
  depth: false,
  stencil: false,
  powerPreference: 'low-power',
} as const

/**
 * CSS 색을 셰이더가 그대로 칠할 sRGB 값으로 읽습니다. three 는 색을 받자마자 선형으로 바꿔
 * 두는데, 이 셰이더는 색 공간 변환 없이 바로 칠해서 되돌려 둡니다 — 안 되돌리면 빛이 탁해집니다.
 */
function readColor(style: CSSStyleDeclaration, name: string, fallback: string) {
  const value = style.getPropertyValue(name).trim() || fallback
  return new Color(value).convertLinearToSRGB()
}

/**
 * 물결 — 수면을 지난 빛이 물속에 그리는 그물(caustics).
 *
 * 화면을 덮는 판 한 장을 정사영 카메라로 찍고, 빛 그물은 전부 조각 셰이더가 셉니다
 * (`causticsShader.ts`). 빛만 내고 바탕은 투명이라 **뒤에 깔린 그림이 곧 물 색**입니다.
 * 자리 · 겹 순서는 부르는 쪽이 `className` 으로 정합니다.
 *
 * - WebGL 을 못 쓰면 아무것도 그리지 않고 비켜섭니다. 뒤의 바탕이 그대로 남습니다
 * - 움직임 줄이기면 멈춘 한 장만 그립니다
 * - 첫 장이 그려진 뒤에 서서히 드러납니다 — three 를 따로 받아 오는 동안 빈 판이 번쩍이지 않게
 *
 * @param className 자리 · 크기 · 겹 순서. 스스로는 크기를 갖지 않습니다
 * @param layers 깔 겹 수. 0 은 없음 · 1 은 옅은 그물만 · 2 는 하얀 그물까지(기본).
 *   바뀌면 새 값으로 서서히 깔리거나 걷힙니다
 */
export function WaterCaustics({
  className,
  layers = 2,
}: {
  className?: string
  layers?: number
}) {
  const layer = useRef<HTMLDivElement>(null)
  // NOTE: 겹은 그리는 고리가 매 장 읽습니다 — 상태로 두면 바뀔 때마다 WebGL 을 새로 엽니다
  const target = useRef(layers)
  // 움직임 줄이기면 고리가 돌지 않아, 바뀐 겹을 한 장 그려 줄 손잡이입니다
  const redraw = useRef<(() => void) | null>(null)

  useEffect(() => {
    target.current = layers
    redraw.current?.()
  }, [layers])

  useEffect(() => {
    const host = layer.current
    if (!host) return

    /*
     * NOTE: 캔버스를 JSX 가 아니라 여기서 만듭니다. StrictMode 는 이펙트를 두 번 돌리는데,
     * 정리할 때 컨텍스트를 놓아 버린(forceContextLoss) 캔버스는 다시 켜지지 않습니다.
     *
     * WebGL 이 없는지는 먼저 물어봅니다 — three 에 맡기면 예외와 콘솔 오류를 남깁니다.
     * 같은 캔버스에 같은 이름으로 다시 물으면 같은 컨텍스트가 오므로 three 가 이것을 씁니다.
     */
    const canvas = document.createElement('canvas')
    const probe =
      canvas.getContext('webgl2', CONTEXT) ??
      canvas.getContext('webgl', CONTEXT)
    if (!probe) return

    canvas.className = 'block size-full'
    host.append(canvas)

    const renderer = new WebGLRenderer({ canvas, ...CONTEXT })
    renderer.setClearColor(0x000000, 0)

    const style = getComputedStyle(host)
    const uniforms = {
      uTime: { value: 0 },
      uResolution: { value: new Vector2(1, 1) },
      uScale: { value: CAUSTICS.scale },
      uIntensity: { value: CAUSTICS.intensity },
      uDispersion: { value: CAUSTICS.dispersion },
      uRays: { value: CAUSTICS.rays },
      uWobble: { value: CAUSTICS.wobble },
      uGlow: { value: readColor(style, '--caustics-glow', '#a7c8db') },
      uCore: { value: readColor(style, '--caustics-core', '#f2f9ff') },
      // 처음 뜰 때는 따라가지 않고 제 겹으로 섭니다 — 드러나는 것은 판의 불투명도가 맡습니다
      uFine: { value: fineOf(target.current) },
      uWide: { value: wideOf(target.current) },
    }

    const scene = new Scene()
    const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1)
    const geometry = new PlaneGeometry(2, 2)
    const material = new ShaderMaterial({
      uniforms,
      vertexShader: causticsVertex,
      fragmentShader: causticsFragment,
      depthTest: false,
      depthWrite: false,
    })
    const plane = new Mesh(geometry, material)
    plane.frustumCulled = false
    scene.add(plane)

    const started = performance.now()
    let lastEased = started
    const draw = (now: number) => {
      const ease = 1 - Math.exp(-Math.max(now - lastEased, 0) / LAYER_EASE_MS)
      lastEased = Math.max(now, lastEased)
      uniforms.uFine.value +=
        (fineOf(target.current) - uniforms.uFine.value) * ease
      uniforms.uWide.value +=
        (wideOf(target.current) - uniforms.uWide.value) * ease

      uniforms.uTime.value = ((now - started) / 1000) * CAUSTICS.speed
      renderer.render(scene, camera)
      host.dataset.ready = ''
    }

    const reduced = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches
    let lastDrawn = started

    if (reduced) {
      redraw.current = () => {
        uniforms.uFine.value = fineOf(target.current)
        uniforms.uWide.value = wideOf(target.current)
        draw(lastDrawn)
      }
    }

    // 크기를 바꾸면 그리기 버퍼가 비워지므로 기다리지 않고 바로 한 장 그립니다
    const fit = () => {
      renderer.setPixelRatio(
        Math.min(window.devicePixelRatio, 1) * RENDER_SCALE,
      )
      renderer.setSize(host.clientWidth, host.clientHeight, false)
      renderer.getDrawingBufferSize(uniforms.uResolution.value)
      draw(lastDrawn)
    }
    const resize = new ResizeObserver(fit)
    resize.observe(host)
    fit()

    let frame = 0
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick)
      // 2ms 는 화면 주기의 흔들림 몫 — 60Hz 에서 한 장 걸러 한 장이 고르게 떨어집니다
      if (now - lastDrawn < FRAME_MS - 2) return
      lastDrawn = now
      draw(now)
    }
    if (!reduced) frame = requestAnimationFrame(tick)

    return () => {
      redraw.current = null
      cancelAnimationFrame(frame)
      resize.disconnect()
      geometry.dispose()
      material.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
      canvas.remove()
      delete host.dataset.ready
    }
  }, [])

  return (
    <div
      ref={layer}
      aria-hidden="true"
      className={cn(
        'pointer-events-none opacity-0 transition-opacity duration-1000 data-ready:opacity-100 motion-reduce:transition-none',
        className,
      )}
    />
  )
}
