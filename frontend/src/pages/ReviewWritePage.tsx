import { useState } from 'react'
import { useSearchParams } from 'react-router'

import {
  ImageAttachField,
  ModerationRejectedModal,
  WriteForm,
  type ModerationRejection,
} from '@/features/community'
import { ROUTES } from '@/shared/config/routes'
import { cn } from '@/shared/lib/cn'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'
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
    <>
      <WriteForm
        title="후기 쓰기"
        description="대상 향수는 필수이고 한 개만 답니다. 후기에는 분류가 없고, 포스팅하면 정책 검수를 거칩니다."
        cancelTo={ROUTES.COMMUNITY_REVIEWS}
        submitLabel="포스팅"
        submitDisabled={!targetPerfume || title.trim().length === 0}
        onSubmit={() => {
          // TODO: CMT-03 포스팅 API 연결. 검수를 통과하면 게시글 상세로 이동하고
          // 보류되면 응답의 사유로 A25 모달을 띄웁니다.
          setRejection({
            reasons: ['향수 커뮤니티 주제와 관련이 없는 내용입니다'],
            requestedChange: '향수 관련 내용으로 수정해주세요',
          })
        }}
      >
        {/*
          대상 향수는 필수이고 한 개만 답니다. 이 화면에서 가장 먼저 정해야 하는
          값이라 다른 항목과 달리 칸으로 감싸 무게를 줍니다 — 고르지 않으면
          [포스팅] 이 꺼져 있는데, 그 이유가 눈에 보여야 합니다.
        */}
        <fieldset
          className={cn(
            'rounded-card border p-3.75',
            targetPerfume
              ? 'border-line-soft bg-surface-sunken'
              : 'border-danger bg-surface-card',
          )}
        >
          <legend className="text-ink text-caption px-1.25 font-medium">
            대상 향수 <span className="text-danger">*</span>
          </legend>

          <div className="flex flex-wrap items-center gap-2.5">
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
            {/* TODO: 향수 검색 연결 (화면에서 향수 도메인과 조합) */}
            <Button
              variant="outline"
              size="sm"
              type="button"
              className="ml-auto"
            >
              {targetPerfume ? '변경' : '향수 선택'}
            </Button>
          </div>
        </fieldset>

        {/*
          라벨을 보이게 두었습니다. placeholder 로만 알려주면 한 글자라도 치는
          순간 무엇을 적는 칸인지 사라집니다.
        */}
        <Input
          label="제목"
          placeholder="제목을 입력하세요"
          required
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />

        <Textarea
          label="본문"
          placeholder="이 향을 어떻게 맡았는지 적어주세요"
          rows={12}
          required
          value={content}
          onChange={(event) => setContent(event.target.value)}
        />

        <ImageAttachField />
      </WriteForm>

      <ModerationRejectedModal
        open={rejection !== null}
        onClose={() => setRejection(null)}
        rejection={rejection}
      />
    </>
  )
}
