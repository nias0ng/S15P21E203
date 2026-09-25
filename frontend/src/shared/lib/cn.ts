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

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
