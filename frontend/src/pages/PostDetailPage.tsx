import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useParams } from 'react-router'

import {
  CommentSection,
  commentsQuery,
  POST_CATEGORIES,
  postDetailQuery,
} from '@/features/community'
import { ROUTES, toPerfumeDetail } from '@/shared/config/routes'
import { cn } from '@/shared/lib/cn'
import { formatRelativeTime } from '@/shared/lib/formatRelativeTime'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { EmptyState } from '@/shared/ui/EmptyState'
import { LinkButton } from '@/shared/ui/LinkButton'
import { PageFallback } from '@/shared/ui/PageFallback'
import { Thumbnail } from '@/shared/ui/Thumbnail'

/**
 * 게시글 상세 + 댓글 (와이어프레임 A23 — CMT-02 · 07 · 08 · 09 · 10 · 11)
 *
 * 와이어프레임 주석: "연결 향수와 첨부 이미지가 없으면 이 영역들을 표시하지 않는다".
 * 자유 글은 향수를 걸지 않아도 되므로 값이 있을 때만 그립니다.
 *
 * 폭을 46rem(736px)으로 좁힙니다. 이 화면은 목록이 아니라 **읽는 화면**이라 본문이
 * 1120px 을 꽉 채우면 한 줄이 100자를 넘어가고, 줄을 바꿀 때마다 눈이 왼쪽 끝을
 * 다시 찾아야 합니다. 한글 13px 에서 736px 는 한 줄 약 55자입니다.
 */
export default function PostDetailPage() {
  const { postId } = useParams<{ postId: string }>()
  const numericId = Number(postId)

  const post = useQuery({
    ...postDetailQuery(numericId),
    enabled: Number.isFinite(numericId),
  })
  const comments = useQuery({
    ...commentsQuery(numericId),
    enabled: Number.isFinite(numericId),
  })

  const [deleteOpen, setDeleteOpen] = useState(false)

  if (post.isPending) return <PageFallback />
  if (post.isError || !post.data) {
    return (
      <EmptyState
        title="게시글 상세 정보를 불러오지 못했습니다"
        description="다시 시도해주세요."
        action={
          <Button variant="outline" onClick={() => post.refetch()}>
            다시 시도
          </Button>
        }
      />
    )
  }

  const data = post.data
  const backTo =
    data.board === 'REVIEW' ? ROUTES.COMMUNITY_REVIEWS : ROUTES.COMMUNITY_FREE
  const editTo =
    data.board === 'REVIEW' ? ROUTES.REVIEW_WRITE : ROUTES.POST_WRITE

  return (
    <div className="mx-auto max-w-[46rem] space-y-8">
      <LinkButton to={backTo} variant="outline" size="sm">
        ← 커뮤니티
      </LinkButton>

      <article className="space-y-6">
        {/* 제목 묶음. 아래 선으로 본문과 나눕니다 — hr 을 따로 두면 간격이 두 번 생깁니다 */}
        <header className="border-line space-y-3 border-b pb-6">
          {data.category && (
            <Badge tone="neutral">
              {
                POST_CATEGORIES.find((item) => item.value === data.category)
                  ?.label
              }
            </Badge>
          )}
          {/* 이 화면의 대표 제목이라 display 입니다 (UI 명세 1.1) */}
          <h1 className="text-ink text-display font-serif font-bold">
            {data.title}
          </h1>

          <div className="text-caption flex items-center gap-2">
            <span className="text-ink">{data.nickname}</span>
            <span className="text-ink-muted">
              · {formatRelativeTime(data.createdAt)} · 조회 {data.viewCount}
            </span>

            {data.mine && (
              <span className="ml-auto flex gap-2">
                <LinkButton to={editTo} variant="outline" size="sm">
                  수정
                </LinkButton>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDeleteOpen(true)}
                >
                  삭제
                </Button>
              </span>
            )}
          </div>
        </header>

        <p className="text-ink text-body whitespace-pre-wrap">{data.content}</p>

        {/* 첨부 이미지가 없으면 영역 자체를 그리지 않습니다 */}
        {data.imageUrls.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-ink-muted text-caption font-medium">
              첨부 이미지
            </h2>
            <ul className="flex flex-wrap gap-2">
              {data.imageUrls.map((url) => (
                <li key={url}>
                  <Thumbnail src={url} className="h-32" />
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* 컬렉션 공유 글에만 붙습니다 */}
        {data.collectionTitle && (
          <section className="space-y-2">
            <h2 className="text-ink-muted text-caption font-medium">
              첨부 컬렉션
            </h2>
            <p className="border-line-soft bg-surface-sunken text-ink text-body rounded-card inline-flex w-fit max-w-full border px-3 py-2">
              {data.collectionTitle}
            </p>
          </section>
        )}

        {/* 연결 향수가 없으면 영역 자체를 그리지 않습니다 */}
        {data.relatedPerfumes.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-ink-muted text-caption font-medium">
              연결된 향수
            </h2>
            <ul className="space-y-2">
              {data.relatedPerfumes.map((perfume) => (
                <li key={perfume.perfumeId}>
                  <Link
                    to={toPerfumeDetail(perfume.perfumeId)}
                    className={cn(
                      'border-line-soft bg-surface-sunken hover:border-accent rounded-card',
                      'inline-flex w-fit max-w-full items-baseline gap-2 border px-3 py-2',
                      'transition-colors duration-120 ease-out',
                      'focus-visible:ring-accent-deep outline-none focus-visible:ring-2',
                    )}
                  >
                    <span className="text-ink text-body font-medium">
                      {perfume.name}
                    </span>
                    <span className="text-ink-muted text-caption">
                      {perfume.brand}
                    </span>
                    <span className="text-ink-muted text-caption ml-auto">
                      향수 상세 →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </article>

      <hr className="border-line" />

      <CommentSection
        comments={comments.data ?? []}
        onCreate={() => {
          // TODO: CMT-09 댓글 작성 API 연결
        }}
        onUpdate={() => {
          // TODO: CMT-10 댓글 수정 API 연결
        }}
        onDelete={() => {
          // TODO: CMT-11 댓글 삭제 API 연결
        }}
      />

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title={`'${data.title}' 게시글을 삭제할까요?`}
        onConfirm={() => {
          // TODO: CMT-07 게시글 삭제 API 연결 후 게시판으로 이동
          setDeleteOpen(false)
        }}
      />
    </div>
  )
}
