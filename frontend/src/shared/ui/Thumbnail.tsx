import { cn } from '@/shared/lib/cn'

type ThumbnailProps = {
  /**
   * 이미지 주소. 백엔드가 아직 이미지를 거의 안 내려줘 대부분 값 없이 씁니다 —
   * 없는 경우가 기본 동작입니다.
   */
  src?: string | null
  /** 자리표시자 안에 보일 문구("이미지" · "로고"). 없으면 빈 상자만 그립니다. */
  fallback?: string
  /** 잘리면 안 되는 이미지(브랜드 로고)는 'contain'. 기본은 꽉 채우는 'cover'. */
  fit?: 'cover' | 'contain'
  /**
   * 이미지가 있을 때 상자(테두리 · 바탕)를 그리지 않습니다 — 배경이 투명한
   * PNG(향수병)용입니다. **없을 때는 상자를 그대로 그립니다**(자리표시자).
   */
  bare?: boolean
  /** 크기·배치. 부르는 곳마다 달라 enum 으로 두지 않았습니다 */
  className?: string
  /**
   * img 의 alt. 기본값은 빈 문자열입니다 — 호출부 대부분이 이미지 옆에 향수명·브랜드명을
   * 글자로 이미 보여주고 있어서, alt 를 채우면 화면 낭독기가 같은 내용을 두 번 읽습니다.
   */
  alt?: string
}

/**
 * 이미지 슬롯. 있으면 그리고, 없으면 자리표시자 상자를 그립니다. 아바타
 * (`rounded-full`)도 같은 상자라 이걸 씁니다.
 *
 *   <Thumbnail src={review.profileImageUrl} className="size-7.5 shrink-0 rounded-full" />
 *   <Thumbnail src={brand.logoUrl} fallback="로고" fit="contain" className="h-40 w-full" />
 */
export function Thumbnail({
  src,
  fallback,
  fit = 'cover',
  bare = false,
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
          !bare && box,
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
        'text-ink-muted text-caption flex items-center justify-center',
        className,
      )}
    >
      {fallback}
    </span>
  )
}
