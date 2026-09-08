import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Tailwind 클래스를 합칩니다. 공용 컴포넌트에 className 을 넘겨 덮어쓸 때 씁니다.
 *
 * 문자열을 그냥 이어붙이면 나중에 오는 클래스가 이기는 게 아니라 CSS 우선순위에 따라
 * 결정돼서, `<Button className="px-8">` 처럼 덮어쓰려 해도 기본값이 살아남습니다.
 * twMerge 는 같은 속성끼리 충돌을 감지해 뒤에 온 것만 남깁니다.
 *
 *   cn('px-4 py-2', 'px-8')        -> 'py-2 px-8'
 *   cn('text-ink', isError && 'text-red-600')
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
