import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

/**
 * tailwind-merge 는 Tailwind 기본 스케일 이름만 알고 있습니다.
 * `@theme` 에 우리가 추가한 토큰(text-body · shadow-raised …)은 어느 속성인지 모르니
 * 충돌로 보지 않고 둘 다 남깁니다.
 *
 *   cn('text-body', 'text-base')   등록 전 -> 'text-body text-base'  (둘 다 남아 CSS 순서가 이김)
 *                                  등록 후 -> 'text-base'
 *
 * 그래서 우리 토큰을 같은 그룹으로 등록합니다.
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
 * 문자열을 그냥 이어붙이면 나중에 오는 클래스가 이기는 게 아니라 CSS 우선순위에 따라
 * 결정돼서, `<Button className="px-7.5">` 처럼 덮어쓰려 해도 기본값이 살아남습니다.
 * twMerge 는 같은 속성끼리 충돌을 감지해 뒤에 온 것만 남깁니다.
 *
 *   cn('px-3.75 py-2.5', 'px-7.5')  -> 'py-2.5 px-7.5'
 *   cn('text-ink', isError && 'text-danger')
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
