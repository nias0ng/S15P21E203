import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

/**
 * tailwind-merge 는 Tailwind 기본 스케일 이름만 알아, `@theme` 에 우리가 추가한
 * 토큰은 충돌로 보지 않고 둘 다 남깁니다(`cn('text-body', 'text-base')`).
 * **`styles/index.css` 의 `@theme` 에 토큰을 더하면 여기도 함께 더해야 합니다.**
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [
        { text: ['display', 'title', 'heading', 'body', 'caption'] },
      ],
      shadow: [{ shadow: ['raised', 'overlay', 'modal'] }],
    },
  },
})

/**
 * Tailwind 클래스를 합칩니다. 문자열을 그냥 이어붙이면 나중에 온 클래스가 이기는 게
 * 아니라 CSS 우선순위로 정해져, `<Button className="px-7.5">` 로 덮어써도 기본값이
 * 살아남습니다. twMerge 는 같은 속성끼리 뒤에 온 것만 남깁니다.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
