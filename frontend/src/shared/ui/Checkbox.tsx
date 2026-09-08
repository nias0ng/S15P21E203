import { cn } from '@/shared/lib/cn'

/**
 * 사각 체크박스 (와이어프레임 기준 14px).
 *
 * 브라우저 기본 체크박스를 숨기지 않고 모양만 바꿉니다(appearance-none).
 * div 로 흉내내면 키보드 포커스와 스페이스바 토글을 잃습니다.
 *
 * 라벨은 호출하는 쪽에서 <label> 로 감싸주세요.
 *   <label className="flex items-center gap-2.5">
 *     <Checkbox checked={x} onChange={...} />
 *     <span className="text-xs">전체 동의</span>
 *   </label>
 */
export function Checkbox({
  className,
  ...props
}: Omit<React.ComponentPropsWithRef<'input'>, 'type'>) {
  return (
    <input
      type="checkbox"
      className={cn(
        'border-line size-3.5 shrink-0 appearance-none border bg-white',
        'checked:bg-ink',
        'focus-visible:ring-accent outline-none focus-visible:ring-2',
        'disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}
