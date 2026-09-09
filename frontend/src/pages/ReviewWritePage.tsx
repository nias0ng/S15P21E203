import { useState } from 'react'
import { useSearchParams } from 'react-router'

import {
  ModerationRejectedModal,
  type ModerationRejection,
} from '@/features/community'
import { ROUTES } from '@/shared/config/routes'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'
import { LinkButton } from '@/shared/ui/LinkButton'
import { Textarea } from '@/shared/ui/Textarea'

/**
 * 후기 게시글 작성 · 수정 (와이어프레임 A24a — CMT-03 · CMT-06)
 *
 * 와이어프레임 주석:
 * - 분류를 고르지 않는다 — 후기 게시판 글은 전부 같은 종류다
 * - 대상 향수는 필수 · 한 개만 · 향수 상세(A10)에서 들어오면 이미 채워져 있다
 * - [포스팅] → 검사 → 통과하면 A23, 걸리면 A25 모달
 *
 * 향수 상세에서 오면 `?perfumeId=` 를 달고 옵니다.
 */
export default function ReviewWritePage() {
  const [searchParams] = useSearchParams()
  const preselectedId = searchParams.get('perfumeId')

  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [rejection, setRejection] = useState<ModerationRejection | null>(null)

  // TODO: perfumeId 로 향수를 조회해 이름 · 브랜드를 채우세요 (화면에서 조합)
  const targetPerfume = preselectedId
    ? { name: '조 말론 우드 세이지', brand: '조 말론 런던' }
    : null

  return (
    <div className="space-y-4">
      <h1 className="text-ink text-title font-serif font-semibold">
        후기 쓰기
      </h1>

      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault()
          // TODO: CMT-03 포스팅 API 연결. 검수를 통과하면 게시글 상세로 이동하고
          // 보류되면 응답의 사유로 A25 모달을 띄웁니다.
          setRejection({
            reasons: ['향수 커뮤니티 주제와 관련이 없는 내용입니다'],
            requestedChange: '향수 관련 내용으로 수정해주세요',
          })
        }}
      >
        {/* 대상 향수는 필수이고 한 개만 답니다 */}
        <div className="border-line flex items-center gap-3 border px-3 py-3">
          <span className="text-ink-muted text-caption">대상 향수</span>
          {targetPerfume ? (
            <>
              <span className="text-ink text-body font-medium">
                {targetPerfume.name}
              </span>
              <span className="text-ink-muted text-caption">
                {targetPerfume.brand}
              </span>
            </>
          ) : (
            <span className="text-ink-muted text-body">
              향수를 선택해야 후기를 쓸 수 있습니다
            </span>
          )}
          <Button variant="outline" size="sm" className="ml-auto">
            {targetPerfume ? '변경' : '향수 선택'}
          </Button>
        </div>

        <Input
          label="제목"
          hideLabel
          placeholder="제목을 입력하세요"
          required
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />

        <Textarea
          label="본문"
          hideLabel
          placeholder="이 향을 어떻게 맡았는지 적어주세요"
          rows={12}
          required
          value={content}
          onChange={(event) => setContent(event.target.value)}
        />

        <div className="space-y-2">
          <p className="text-ink-muted text-caption">이미지 첨부</p>
          {/* TODO: 이미지 업로드 연결 (형식 · 용량 제한은 별도 정책) */}
          <Button variant="outline" size="sm">
            + 이미지 첨부
          </Button>
        </div>

        <div className="flex justify-end gap-2">
          <LinkButton to={ROUTES.COMMUNITY_REVIEWS} variant="outline">
            취소
          </LinkButton>
          <Button
            type="submit"
            disabled={!targetPerfume || title.trim().length === 0}
          >
            포스팅
          </Button>
        </div>

        <p className="text-ink-muted text-caption leading-relaxed">
          후기 게시판 글은 분류가 없습니다. 대상 향수는 필수이고 한 개만 답니다.
          포스팅하면 정책 검수를 거치고, 보류되면 작성한 내용을 유지한 채 사유를
          안내합니다.
        </p>
      </form>

      <ModerationRejectedModal
        open={rejection !== null}
        onClose={() => setRejection(null)}
        rejection={rejection}
      />
    </div>
  )
}
