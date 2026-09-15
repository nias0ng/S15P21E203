import { useState } from 'react'

import {
  ImageAttachField,
  LinkedPerfumeModal,
  ModerationRejectedModal,
  POST_CATEGORIES,
  WriteForm,
  type LinkedPerfume,
  type ModerationRejection,
  type PostCategory,
} from '@/features/community'
import { ROUTES } from '@/shared/config/routes'
import { cn } from '@/shared/lib/cn'
import { Button } from '@/shared/ui/Button'
import { ChipToggle } from '@/shared/ui/ChipToggle'
import { Input } from '@/shared/ui/Input'
import { Textarea } from '@/shared/ui/Textarea'

/**
 * 자유 게시글 작성 · 수정 (와이어프레임 A24b — CMT-03 · CMT-06 · CMT-16)
 *
 * 분류는 필수이고, 컬렉션 첨부는 "컬렉션 공유" 를 골랐을 때만 나타납니다.
 * [포스팅] 은 검사를 거쳐 통과하면 A23, 걸리면 A25 모달로 갑니다.
 */
export default function PostWritePage() {
  const [category, setCategory] = useState<PostCategory | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [perfumes, setPerfumes] = useState<LinkedPerfume[]>([])
  const [pickOpen, setPickOpen] = useState(false)
  const [rejection, setRejection] = useState<ModerationRejection | null>(null)

  return (
    <>
      <WriteForm
        title="글쓰기"
        description="분류는 필수입니다. 컬렉션 첨부는 컬렉션 공유를 골랐을 때만 나타나고, 관련 향수와 이미지는 없어도 됩니다."
        cancelTo={ROUTES.COMMUNITY_FREE}
        submitLabel="포스팅"
        // 분류는 필수입니다
        submitDisabled={category === null || title.trim().length === 0}
        onSubmit={() => {
          // TODO: CMT-03 포스팅 API 연결
          setRejection({
            reasons: ['부적절한 표현이 포함되어 있습니다'],
            requestedChange: '향수 관련 내용으로 수정해주세요',
          })
        }}
      >
        {/*
          fieldset 과 legend 로 묶습니다. 예전에는 `<span>분류</span>` 였는데,
          낭독기에는 칩 세 개가 무엇을 고르는 것인지 전해지지 않았습니다.
        */}
        <fieldset className="space-y-2.5">
          <legend className="text-ink text-caption font-medium">
            분류 <span className="text-danger">*</span>
          </legend>
          <ChipToggle
            label="게시글 분류"
            options={POST_CATEGORIES}
            value={category}
            onChange={setCategory}
          />
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
          placeholder="내용을 입력하세요"
          rows={12}
          required
          value={content}
          onChange={(event) => setContent(event.target.value)}
        />

        {/* 컬렉션 첨부는 컬렉션 공유를 골랐을 때만 나타납니다 */}
        {category === 'COLLECTION' && (
          <fieldset className="space-y-2.5">
            <legend className="text-ink text-caption font-medium">
              컬렉션 첨부
            </legend>
            {/* TODO: 내 컬렉션 선택 연결 (화면에서 컬렉션 도메인과 조합) */}
            <Button variant="outline" size="sm" type="button">
              + 내 컬렉션에서
            </Button>
          </fieldset>
        )}

        <fieldset className="space-y-2.5">
          <legend className="text-ink text-caption font-medium">
            관련 향수 <span className="text-ink-muted">(선택)</span>
          </legend>
          <div className="flex flex-wrap items-center gap-2.5">
            {perfumes.map((perfume) => (
              <span
                key={perfume.perfumeId}
                className="border-line-soft bg-surface-sunken text-ink text-caption rounded-card flex items-center gap-2.5 border px-2.5 py-2.5"
              >
                {perfume.name}
                <button
                  type="button"
                  aria-label={`${perfume.name} 제거`}
                  onClick={() =>
                    setPerfumes((prev) =>
                      prev.filter(
                        (item) => item.perfumeId !== perfume.perfumeId,
                      ),
                    )
                  }
                  className={cn(
                    'text-ink-muted hover:text-ink rounded-card',
                    'transition-colors duration-120 ease-out',
                    'focus-visible:ring-accent-deep outline-none focus-visible:ring-2',
                  )}
                >
                  <span aria-hidden>×</span>
                </button>
              </span>
            ))}
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={() => setPickOpen(true)}
            >
              + 향수 선택
            </Button>
          </div>
        </fieldset>

        <ImageAttachField />
      </WriteForm>

      {/*
        후보 목록은 이 화면에서 넘깁니다. features 끼리는 import 할 수 없으므로
        향수 검색 결과를 여기서 조합해야 합니다.
        TODO: 향수 검색 API 연결
      */}
      <LinkedPerfumeModal
        open={pickOpen}
        onClose={() => setPickOpen(false)}
        candidates={[]}
        onSearch={() => {}}
        onSubmit={(picked) => {
          setPerfumes((prev) => [
            ...prev,
            ...picked.filter(
              (item) =>
                !prev.some((existing) => existing.perfumeId === item.perfumeId),
            ),
          ])
          setPickOpen(false)
        }}
      />

      <ModerationRejectedModal
        open={rejection !== null}
        onClose={() => setRejection(null)}
        rejection={rejection}
      />
    </>
  )
}
