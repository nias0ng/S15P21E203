import { useMutation } from '@tanstack/react-query'
import { useRef } from 'react'

import { isApiError } from '@/shared/api/http'
import { cn } from '@/shared/lib/cn'
import { Button } from '@/shared/ui/Button'
import { Thumbnail } from '@/shared/ui/Thumbnail'

import { removeProfileImage, uploadProfileImage } from '../api'

type Props = {
  /** 지금 사진 주소. 없으면 `null` */
  value: string | null
  /** 올렸으면 새 주소, 지웠으면 `null` */
  onChange: (next: string | null) => void
}

/**
 * 프로필 사진 고르기 · 지우기 (A29 — COM-04).
 *
 * **캐시를 고치는 일과 토스트는 부르는 쪽이 합니다.** 여기는 서버에 보내고 결과 주소만
 * 알립니다 — `features/community` 의 `ImageAttachField` 와 같은 나눔입니다.
 *
 * **형식 · 용량을 화면에서 미리 걸러내지 않습니다.** 서버가 파일 이름이 아니라 내용으로
 * 형식을 보고, 용량 제한도 설정으로 바뀝니다 — 같은 규칙을 화면에 한 벌 더 두면 서버가
 * 값을 바꾼 날 둘이 갈라집니다. `accept` 는 파일 고르기 창을 좁혀 주는 **거들기**일 뿐입니다.
 */
export function ProfileImageField({ value, onChange }: Props) {
  /* 같은 파일을 다시 고를 수 있게 비워 둘 자리 — 값이 같으면 change 가 안 옵니다 */
  const inputRef = useRef<HTMLInputElement>(null)

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
      {/* 어두운 방이 `bg-line-soft` 를 흰 12% 로 뒤집어, 사진이 없을 때 어둠 위에 아이보리 사각형이 남지 않습니다 */}
      {value === null ? (
        <div className="border-line bg-line-soft text-ink-muted rounded-card text-caption flex size-25 shrink-0 items-center justify-center border">
          프로필
        </div>
      ) : (
        <Thumbnail
          src={value}
          alt="내 프로필 사진"
          className="rounded-card size-25 shrink-0"
        />
      )}

      <div className="flex flex-col gap-1.25">
        {/*
          단추처럼 보이는 라벨입니다. `<input type="file">` 은 브라우저마다 생김새가
          다르고 색을 못 입힙니다 — 숨기고 라벨이 대신 받습니다. `Button` 은 `<button>`
          이라 안에 넣으면 라벨의 클릭이 막혀, 여기서만 생김새를 손으로 맞춥니다.

          NOTE: 높이 · 바닥은 `Button` 의 `sm` 과 같은 값입니다(`shared/ui/buttonVariants`).
          바로 아래 [이미지 삭제] 가 그 `sm` 이라, 바닥이 한쪽에만 있으면 1536 에서
          둘의 높이가 24 · 27.1 로 갈립니다.
        */}
        <label
          className={cn(
            'border-line text-ink rounded-card inline-flex h-7.5 min-h-[calc(var(--text-body)*var(--text-body--line-height)+5px)] w-fit items-center border px-2.5',
            'text-body cursor-pointer font-medium',
            'hover:bg-line-soft transition-colors duration-120 ease-out',
            'focus-within:ring-accent-deep focus-within:ring-2',
            busy && 'pointer-events-none opacity-50',
          )}
        >
          {upload.isPending ? '올리는 중' : '이미지 변경'}
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            className="sr-only"
            aria-label="프로필 사진 고르기"
            disabled={busy}
            onChange={(event) => {
              const picked = event.target.files?.[0]
              /* 같은 파일을 다시 골라도 change 가 오게 칸을 비웁니다 */
              if (inputRef.current) inputRef.current.value = ''
              if (picked) upload.mutate(picked)
            }}
          />
        </label>

        {/* 지울 것이 없는데 부르면 서버가 무엇을 답하는지 모릅니다 */}
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
            {isApiError(error)
              ? error.message
              : '프로필 사진을 바꾸지 못했습니다. 잠시 후 다시 시도해주세요.'}
          </p>
        )}
      </div>
    </div>
  )
}
