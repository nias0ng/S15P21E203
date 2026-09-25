import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

// NOTE: `styles/index.css` 의 `@theme` 에 토큰을 더하면 여기에도 더합니다.
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
