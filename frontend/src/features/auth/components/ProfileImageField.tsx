import { useMutation } from '@tanstack/react-query'

import { apiErrorMessage } from '@/shared/api/http'
import { cn } from '@/shared/lib/cn'
import { Button } from '@/shared/ui/Button'
import { FileButton } from '@/shared/ui/FileButton'
import { Thumbnail } from '@/shared/ui/Thumbnail'

import { removeProfileImage, uploadProfileImage } from '../api'

type Props = {
  value: string | null
  onChange: (next: string | null) => void
}

export function ProfileImageField({ value, onChange }: Props) {
  const upload = useMutation({
    mutationFn: uploadProfileImage,
    onSuccess: (url) => onChange(url),
  })

  const remove = useMutation({
    mutationFn: removeProfileImage,
    onSuccess: () => onChange(null),
  })

  const busy = upload.isPending || remove.isPending
  const error = upload.error ?? remove.error

  return (
    <div className="flex items-start gap-5">
      <Thumbnail
        src={value}
        fallback="프로필"
        alt="내 프로필 사진"
        className={cn(
          'rounded-card size-25 shrink-0',
          value === null && 'bg-line-soft',
        )}
      />

      <div className="flex flex-col gap-1.25">
        <FileButton
          className="w-fit"
          busy={busy}
          inputLabel="프로필 사진 고르기"
          onPick={(file) => upload.mutate(file)}
        >
          {upload.isPending ? '올리는 중' : '이미지 변경'}
        </FileButton>

        <Button
          variant="outline"
          size="sm"
          className="w-fit"
          disabled={value === null || busy}
          isLoading={remove.isPending}
          onClick={() => remove.mutate()}
        >
          이미지 삭제
        </Button>

        <p className="text-ink-muted text-caption leading-relaxed">
          JPG · PNG · GIF · WEBP
          {/* NOTE: 1MB 는 백엔드 UserProfileImageProperties.maxSize 의 기본값입니다 — 설정으로 바뀝니다 */}
          <br />한 장당 최대 1MB
        </p>

        {error != null && (
          <p role="alert" className="text-danger text-caption">
            {apiErrorMessage(
              error,
              '프로필 사진을 바꾸지 못했습니다. 잠시 후 다시 시도해주세요.',
            )}
          </p>
        )}
      </div>
    </div>
  )
}
