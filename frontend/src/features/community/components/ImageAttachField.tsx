import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { apiErrorMessage } from '@/shared/api/http'
import { cn } from '@/shared/lib/cn'
import { FileButton } from '@/shared/ui/FileButton'
import { Thumbnail } from '@/shared/ui/Thumbnail'

import { uploadPostImage } from '../api'

type Props = {
  value: string[]
  onChange: (next: string[]) => void
}

export function ImageAttachField({ value, onChange }: Props) {
  const { t } = useTranslation('community')
  const upload = useMutation({
    mutationFn: uploadPostImage,
    onSuccess: (url) => onChange([...value, url]),
  })

  return (
    <fieldset className="space-y-2.5">
      <legend className="text-ink text-caption font-medium">
        {t('imageAttach.legend')}{' '}
        <span className="text-ink-muted">{t('imageAttach.optional')}</span>
      </legend>

      {value.length > 0 && (
        <ul className="flex flex-wrap gap-2.5">
          {value.map((url, index) => (
            <li key={url} className="relative">
              <Thumbnail src={url} className="size-20" />
              <button
                type="button"
                aria-label={t('imageAttach.remove', { index: index + 1 })}
                onClick={() => onChange(value.filter((item) => item !== url))}
                className={cn(
                  'border-line bg-surface-card text-ink absolute -top-1.25 -right-1.25',
                  'rounded-card flex size-5 items-center justify-center border',
                  'hover:bg-line-soft transition-colors duration-120 ease-out',
                  'focus-visible:ring-accent-deep outline-none focus-visible:ring-2',
                )}
              >
                <span aria-hidden>×</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <FileButton
        inputLabel={t('imageAttach.inputLabel')}
        busy={upload.isPending}
        onPick={(file) => upload.mutate(file)}
      >
        {upload.isPending
          ? t('imageAttach.uploading')
          : t('imageAttach.attach')}
      </FileButton>

      {upload.error !== null && (
        <p role="alert" className="text-danger text-caption">
          {apiErrorMessage(upload.error, t('imageAttach.uploadFailed'))}
        </p>
      )}
    </fieldset>
  )
}
