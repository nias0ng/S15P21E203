import { useMutation } from '@tanstack/react-query'

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
  const upload = useMutation({
    mutationFn: uploadPostImage,
    onSuccess: (url) => onChange([...value, url]),
  })

  return (
    <fieldset className="space-y-2.5">
      <legend className="text-ink text-caption font-medium">
        이미지 첨부 <span className="text-ink-muted">(선택)</span>
      </legend>

      {value.length > 0 && (
        <ul className="flex flex-wrap gap-2.5">
          {value.map((url, index) => (
            <li key={url} className="relative">
              <Thumbnail src={url} className="size-20" />
              <button
                type="button"
                aria-label={`사진 ${index + 1} 지우기`}
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
        inputLabel="이미지 추가"
        busy={upload.isPending}
        onPick={(file) => upload.mutate(file)}
      >
        {upload.isPending ? '올리는 중' : '+ 이미지 첨부'}
      </FileButton>

      {upload.error !== null && (
        <p role="alert" className="text-danger text-caption">
          {apiErrorMessage(
            upload.error,
            '사진을 올리지 못했습니다. 잠시 후 다시 시도해주세요.',
          )}
        </p>
      )}
    </fieldset>
  )
}
