import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

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
  const { t } = useTranslation('auth')
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
        fallback={t('profileImage.fallback')}
        alt={t('profileImage.alt')}
        className={cn(
          'rounded-card size-25 shrink-0',
          value === null && 'bg-line-soft',
        )}
      />

      <div className="flex flex-col gap-1.25">
        <FileButton
          className="w-fit"
          busy={busy}
          inputLabel={t('profileImage.pick')}
          onPick={(file) => upload.mutate(file)}
        >
          {upload.isPending
            ? t('profileImage.uploading')
            : t('profileImage.change')}
        </FileButton>

        <Button
          variant="outline"
          size="sm"
          className="w-fit"
          disabled={value === null || busy}
          isLoading={remove.isPending}
          onClick={() => remove.mutate()}
        >
          {t('profileImage.remove')}
        </Button>

        <p className="text-ink-muted text-caption leading-relaxed">
          JPG · PNG · GIF · WEBP
          <br />
          {t('profileImage.sizeLimit')}
        </p>

        {error != null && (
          <p role="alert" className="text-danger text-caption">
            {apiErrorMessage(error, t('profileImage.failed'))}
          </p>
        )}
      </div>
    </div>
  )
}
