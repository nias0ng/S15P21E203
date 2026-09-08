import { cn } from '@/shared/lib/cn'

type ThumbnailProps = {
  /**
   * 이미지 주소. 없으면 자리표시자 상자를 그립니다.
   *
   * ⚠️ 백엔드가 아직 이미지를 거의 내려주지 않아 대부분의 호출부가 값 없이 씁니다.
   * 그래서 optional 이고, 없는 경우가 기본 동작입니다.
   */
  src?: string | null
  /** 자리표시자 안에 보일 문구("이미지" · "로고"). 없으면 빈 상자만 그립니다. */
  fallback?: string
  /** 잘리면 안 되는 이미지(브랜드 로고)는 'contain'. 기본은 꽉 채우는 'cover'. */
  fit?: 'cover' | 'contain'
  /**
   * 크기·배치. 사용처마다 달라서(size-14 · h-24 w-full · flex-1 …) 여기서 받습니다.
   * 크기를 prop enum 으로 두지 않은 이유는 실제로 13가지가 쓰이고 있어서입니다.
   */
  className?: string
  /**
   * img 의 alt. 기본값은 빈 문자열입니다 — 호출부 대부분이 이미지 옆에 향수명·브랜드명을
   * 글자로 이미 보여주고 있어서, alt 를 채우면 화면 낭독기가 같은 내용을 두 번 읽습니다.
   */
  alt?: string
}

/**
 * 이미지 슬롯. 이미지가 있으면 그리고, 없으면 와이어프레임의 자리표시자 상자를 그립니다.
 *
 * 이걸 만들기 전에는 `border-line bg-surface-sunken border` 상자와 그 fallback 분기가
 * 16개 파일에 흩어져 있었습니다. 백엔드가 이미지를 붙이는 시점에 16곳을 고쳐야 했습니다.
 *
 * 아바타(`size-6 rounded-full`)도 같은 상자라서 이걸 씁니다. 나중에 아바타에 이니셜이나
 * 기본 아이콘이 필요해지면 그때 Avatar 를 따로 만듭니다(미리 만들지 않습니다).
 *
 *   <Thumbnail src={perfume.thumbnailUrl} fallback="이미지" className="size-14 shrink-0" />
 *   <Thumbnail src={brand.logoUrl} fallback="로고" fit="contain" className="h-24 w-full" />
 *   <Thumbnail className="size-6 shrink-0 rounded-full" />
 */
export function Thumbnail({
  src,
  fallback,
  fit = 'cover',
  className,
  alt = '',
}: ThumbnailProps) {
  const box = 'border-line bg-surface-sunken border'

  if (src) {
    return (
      <img
        src={src}
        alt={alt}
        className={cn(
          box,
          fit === 'contain' ? 'object-contain' : 'object-cover',
          className,
        )}
      />
    )
  }

  return (
    <span
      // 이미지가 없을 때의 상자는 장식입니다. "이미지" 라는 글자를 낭독기가 읽으면
      // 옆에 있는 실제 이름과 섞여 노이즈가 됩니다.
      aria-hidden
      className={cn(
        box,
        'text-ink-muted flex items-center justify-center text-[10.5px]',
        className,
      )}
    >
      {fallback}
    </span>
  )
}
