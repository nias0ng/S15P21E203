import { useMutation } from '@tanstack/react-query'

import { isApiError } from '@/shared/api/http'
import { cn } from '@/shared/lib/cn'
import { FileButton } from '@/shared/ui/FileButton'
import { Thumbnail } from '@/shared/ui/Thumbnail'

import { uploadPostImage } from '../api'

type Props = {
  /** 올려 둔 이미지 주소. 글을 저장할 때 그대로 `imageUrls` 로 보냅니다 */
  value: string[]
  onChange: (next: string[]) => void
}

/**
 * 이미지 첨부 (A24b — CMT-03 · 06).
 *
 * **글보다 사진이 먼저 올라갑니다.** 고르는 순간 서버로 보내 주소를 받고, 글을 저장할
 * 때 그 주소들을 `imageUrls` 로 넘깁니다. 글이 만들어지기 전에 미리보기를 보여줘야 해서
 * 두 단계로 나뉩니다.
 *
 * 한 번에 한 장씩 부릅니다(서버가 그렇게 받습니다). 한 장이 실패해도 나머지는 남습니다.
 *
 * **형식 · 용량을 화면에서 미리 걸러내지 않습니다.** 서버가 파일 이름이 아니라 내용으로
 * 형식을 보고, 용량 제한도 설정으로 바뀝니다 — 같은 규칙을 화면에 한 벌 더 두면 서버가
 * 값을 바꾼 날 둘이 갈라집니다. `accept` 는 파일 고르기 창을 좁혀 주는 **거들기**일 뿐입니다.
 */
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
          {isApiError(upload.error)
            ? upload.error.message
            : '사진을 올리지 못했습니다. 잠시 후 다시 시도해주세요.'}
        </p>
      )}
    </fieldset>
  )
}
