import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

/**
 * tailwind-merge 는 Tailwind 기본 스케일 이름만 압니다. `@theme` 토큰은 어느 속성인지
 * 몰라 충돌로 보지 않고 둘 다 남기므로, 같은 그룹으로 등록해 줍니다.
 *
 * **`styles/index.css` 의 `@theme` 에 토큰을 추가하면 여기도 함께 추가해야 합니다.**
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
 * Tailwind 클래스를 합칩니다. 공용 컴포넌트에 className 을 넘겨 덮어쓸 때 씁니다.
 *
 * 문자열을 이어붙이면 CSS 우선순위로 결정돼서 `<Button className="px-8">` 로 덮어쓰려
 * 해도 기본값이 살아남습니다. twMerge 는 충돌을 감지해 뒤에 온 것만 남깁니다.
 *
 *   cn('px-4 py-2', 'px-8')  ->  'py-2 px-8'
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
