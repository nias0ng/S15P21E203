import type { ReactNode } from 'react'

import { Button } from '@/shared/ui/Button'

type Props = {
  title: string
  description?: string
  /** 넘기면 [다시 시도] 단추가 섭니다 */
  onRetry?: () => void
  /** 다시 시도 대신 세울 것(돌아가는 길 등) */
  action?: ReactNode
}

/**
 * 진열함 자리에 세우는 안내 — 명조 제목, 짧은 선, 까닭, 단추. 진열대 벽감의 빈 분류 안내와 같은
 * 짜임이라 두 화면에서 "비었다 · 못 불러왔다" 가 같은 목소리로 읽힙니다. 크기는 컬렉션 활자 단의
 * 이름(16) · 본문(13)입니다.
 */
export function CollectionNotice({
  title,
  description,
  onRetry,
  action,
}: Props) {
  return (
    <div className="flex flex-col items-center py-20 text-center">
      <p className="text-heading font-serif font-semibold text-balance break-keep">
        {title}
      </p>
      <span aria-hidden className="mt-3.75 h-px w-10 bg-[var(--hairline)]" />
      {description && (
        <p className="shelf-muted text-body mt-3.75 break-keep">
          {description}
        </p>
      )}
      {(onRetry || action) && (
        <div className="mt-5">
          {action ?? (
            <Button
              variant="outline"
              size="sm"
              className="focus-visible:ring-[var(--shelf-ink)] focus-visible:ring-offset-[var(--paper)]"
              onClick={onRetry}
            >
              다시 시도
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
