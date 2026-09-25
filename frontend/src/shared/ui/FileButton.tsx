import { cn } from '@/shared/lib/cn'
import { buttonVariants } from '@/shared/ui/buttonVariants'

/**
 * 서버가 받는 사진 형식. 파일 고르기 창을 좁혀 주는 거들기일 뿐이고, 형식은 서버가
 * 파일 내용으로 판별합니다.
 */
const IMAGE_ACCEPT = 'image/jpeg,image/png,image/gif,image/webp'

type FileButtonProps = {
  /** 고른 파일 한 장 */
  onPick: (file: File) => void
  /** 숨은 파일 칸의 이름. 낭독기가 단추 글자 대신 이걸 읽습니다 */
  inputLabel: string
  /** 올리는 중이면 흐리게 두고 누름을 막습니다 */
  busy?: boolean
  /** 고를 수 있는 형식. 기본은 사진 네 형식(JPG · PNG · GIF · WEBP) */
  accept?: string
  className?: string
  /** 단추 글자. 올리는 중 문구로 바꾸는 일은 부르는 쪽이 합니다 */
  children: React.ReactNode
}

/**
 * 파일을 고르는 단추. `Button` 의 outline · sm 과 같은 생김새인 `<label>` 이 숨은
 * `<input type="file">` 을 감쌉니다. `<input type="file">` 은 브라우저마다 생김새가
 * 다르고 색을 못 입히고, `<button>` 안에 넣으면 라벨의 클릭이 막혀서입니다.
 *
 * @param props.onPick 파일을 고르면 그 한 장으로 부릅니다. 같은 파일을 다시 골라도 부릅니다
 * @param props.busy 참이면 흐려지고 파일 칸이 꺼집니다
 * @returns 단추처럼 보이는 라벨
 */
export function FileButton({
  onPick,
  inputLabel,
  busy = false,
  accept = IMAGE_ACCEPT,
  className,
  children,
}: FileButtonProps) {
  return (
    <label
      className={cn(
        buttonVariants({ variant: 'outline', size: 'sm' }),
        'cursor-pointer',
        /*
          `focus-within` 이 아니라 `has-[:focus-visible]` 입니다. 숨은 파일 칸은 눌러도
          포커스를 받아, `focus-within` 이면 마우스로 누를 때마다 링이 뜹니다.
        */
        'has-[:focus-visible]:ring-accent-deep has-[:focus-visible]:ring-2',
        busy && 'pointer-events-none opacity-50',
        className,
      )}
    >
      {children}
      <input
        type="file"
        accept={accept}
        className="sr-only"
        aria-label={inputLabel}
        disabled={busy}
        onChange={(event) => {
          const picked = event.target.files?.[0]
          /* 값이 같으면 change 가 안 와서, 같은 파일을 다시 고를 수 있게 비웁니다 */
          event.target.value = ''
          if (picked) onPick(picked)
        }}
      />
    </label>
  )
}
