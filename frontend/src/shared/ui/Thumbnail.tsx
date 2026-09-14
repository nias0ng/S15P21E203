import { cn } from '@/shared/lib/cn'

type ThumbnailProps = {
  /** ⚠️ 백엔드가 이미지를 거의 안 내려줘서, 없는 경우가 기본 동작입니다 */
  src?: string | null
  /** 자리표시자 안에 보일 문구("이미지" · "로고"). 없으면 빈 상자만 그립니다. */
  fallback?: string
  /** 잘리면 안 되는 이미지(브랜드 로고)는 'contain'. 기본은 꽉 채우는 'cover'. */
  fit?: 'cover' | 'contain'
  /** 크기·배치. 실제로 13가지가 쓰이고 있어서 prop enum 으로 두지 않았습니다 */
  className?: string
  /**
   * img 의 alt. 기본값이 빈 문자열인 이유: 호출부 대부분이 이미지 옆에 향수명·브랜드명을
   * 이미 글자로 보여줘서, alt 를 채우면 낭독기가 같은 내용을 두 번 읽습니다.
   */
  alt?: string
}

/**
 * 이미지 슬롯. 이미지가 있으면 그리고, 없으면 와이어프레임의 자리표시자 상자를 그립니다.
 *
 * 아바타(`size-6 rounded-full`)도 같은 상자라서 이걸 씁니다. 이니셜이나 기본 아이콘이
 * 필요해지면 그때 Avatar 를 따로 만듭니다(미리 만들지 않습니다).
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
      // 자리표시자 상자는 장식입니다 — "이미지" 를 읽으면 옆 이름과 섞입니다
      aria-hidden
      className={cn(
        box,
        'text-ink-muted text-caption flex items-center justify-center',
        className,
      )}
    >
      {fallback}
    </span>
  )
}
