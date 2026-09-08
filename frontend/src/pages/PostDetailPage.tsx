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
    <div className="space-y-6">
      <LinkButton to={backTo} variant="outline" size="sm">
        ← 커뮤니티
      </LinkButton>

      <article className="space-y-4">
        <header className="space-y-2">
          {data.category && (
            <Badge tone="neutral">
              {
                POST_CATEGORIES.find((item) => item.value === data.category)
                  ?.label
              }
            </Badge>
          )}
          <h1 className="text-ink text-xl font-bold">{data.title}</h1>

          <div className="flex items-center gap-2 text-[10.5px]">
            <span className="text-ink">{data.nickname}</span>
            <span className="text-ink-muted">
              · {formatRelativeTime(data.createdAt)} · 조회 {data.viewCount}
            </span>

            {data.mine && (
              <span className="ml-auto flex gap-1.5">
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

        <hr className="border-line" />

        <p className="text-ink text-xs leading-relaxed whitespace-pre-wrap">
          {data.content}
        </p>

        {/* 첨부 이미지가 없으면 영역 자체를 그리지 않습니다 */}
        {data.imageUrls.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-ink-muted text-[10.5px]">첨부 이미지</h2>
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
            <h2 className="text-ink-muted text-[10.5px]">첨부 컬렉션</h2>
            <p className="border-line text-ink border px-3 py-2 text-xs">
              {data.collectionTitle}
            </p>
          </section>
        )}

        {/* 연결 향수가 없으면 영역 자체를 그리지 않습니다 */}
        {data.relatedPerfumes.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-ink-muted text-[10.5px]">연결된 향수</h2>
            <ul className="space-y-1.5">
              {data.relatedPerfumes.map((perfume) => (
                <li key={perfume.perfumeId}>
                  <Link
                    to={toPerfumeDetail(perfume.perfumeId)}
                    className="border-line hover:bg-line-soft flex items-center gap-2 border px-3 py-2"
                  >
                    <span className="text-ink text-xs font-bold">
                      {perfume.name}
                    </span>
                    <span className="text-ink-muted text-[10.5px]">
                      {perfume.brand}
                    </span>
                    <span className="text-ink-muted ml-auto text-[10.5px]">
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
