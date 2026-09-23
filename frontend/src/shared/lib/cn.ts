import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

/**
 * NOTE: `styles/index.css` 의 `@theme` 에 토큰을 더하면 여기에도 더합니다.
 * tailwind-merge 는 Tailwind 기본 스케일 이름만 알아, 모르는 토큰은 충돌로 보지 않고
 * 둘 다 남깁니다(`cn('text-body', 'text-base')`).
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [
        { text: ['display', 'title', 'heading', 'body', 'caption'] },
      ],
      shadow: [{ shadow: ['raised', 'overlay', 'modal'] }],
      rounded: [{ rounded: ['card', 'image', 'glass'] }],
    },
  },
})

/**
 * Tailwind 클래스를 합칩니다. 같은 속성은 **뒤에 온 것만** 남습니다 — 문자열을 그냥
 * 이어붙이면 CSS 우선순위로 정해져 `className` 으로 덮어써도 기본값이 살아남습니다.
 *
 * @param inputs clsx 가 받는 값 (문자열 · 배열 · 조건부 객체)
 * @returns 충돌이 정리된 클래스 문자열
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
