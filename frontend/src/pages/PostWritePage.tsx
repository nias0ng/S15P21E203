import { useState } from 'react'

import {
  ModerationRejectedModal,
  PerfumePickModal,
  POST_CATEGORIES,
  type LinkedPerfume,
  type ModerationRejection,
  type PostCategory,
} from '@/features/community'
import { ROUTES } from '@/shared/config/routes'
import { Button } from '@/shared/ui/Button'
import { ChipToggle } from '@/shared/ui/ChipToggle'
import { Input } from '@/shared/ui/Input'
import { LinkButton } from '@/shared/ui/LinkButton'
import { Textarea } from '@/shared/ui/Textarea'

/**
 * 자유 게시글 작성 · 수정 (와이어프레임 A24b — CMT-03 · CMT-06 · CMT-16)
 *
 * 와이어프레임 주석:
 * - 분류는 컬렉션 공유 · 추천 · 잡담 셋 중 하나 — 필수 · 자유 게시판 글에만 있다
 * - 컬렉션 첨부는 컬렉션 공유를 골랐을 때만 나타난다 · 관련 향수 · 이미지는 없어도 된다
 * - [포스팅] → 검사 → 통과하면 A23, 걸리면 A25 모달
 */
export default function PostWritePage() {
  const [category, setCategory] = useState<PostCategory | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [perfumes, setPerfumes] = useState<LinkedPerfume[]>([])
  const [pickOpen, setPickOpen] = useState(false)
  const [rejection, setRejection] = useState<ModerationRejection | null>(null)

  return (
    <div className="space-y-4">
      <h1 className="text-ink text-xl font-bold">글쓰기</h1>

      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault()
          // TODO: CMT-03 포스팅 API 연결
          setRejection({
            reasons: ['부적절한 표현이 포함되어 있습니다'],
            requestedChange: '향수 관련 내용으로 수정해주세요',
          })
        }}
      >
        <div className="flex items-center gap-3">
          <span className="text-ink-muted text-[10.5px]">분류</span>
          <ChipToggle
            label="게시글 분류"
            options={POST_CATEGORIES}
            value={category}
            onChange={setCategory}
          />
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
          placeholder="내용을 입력하세요"
          rows={12}
          required
          className="p-3"
          value={content}
          onChange={(event) => setContent(event.target.value)}
        />

        {/* 컬렉션 첨부는 컬렉션 공유를 골랐을 때만 나타납니다 */}
        {category === 'COLLECTION' && (
          <div className="space-y-1.5">
            <p className="text-ink-muted text-[10.5px]">컬렉션 첨부</p>
            {/* TODO: 내 컬렉션 선택 연결 (화면에서 컬렉션 도메인과 조합) */}
            <Button variant="outline" size="sm">
              + 내 컬렉션에서
            </Button>
          </div>
        )}

        <div className="space-y-1.5">
          <p className="text-ink-muted text-[10.5px]">관련 향수 (선택)</p>
          <div className="flex flex-wrap items-center gap-1.5">
            {perfumes.map((perfume) => (
              <span
                key={perfume.perfumeId}
                className="border-line text-ink flex items-center gap-2 border px-2.5 py-1.5 text-[11px]"
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
                  className="text-ink-muted hover:text-ink"
                >
                  <span aria-hidden>×</span>
                </button>
              </span>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPickOpen(true)}
            >
              + 향수 선택
            </Button>
          </div>
        </div>

        <div className="space-y-1.5">
          <p className="text-ink-muted text-[10.5px]">이미지 첨부 (선택)</p>
          {/* TODO: 이미지 업로드 연결 */}
          <Button variant="outline" size="sm">
            + 이미지 첨부
          </Button>
        </div>

        <div className="flex justify-end gap-1.5">
          <LinkButton to={ROUTES.COMMUNITY_FREE} variant="outline">
            취소
          </LinkButton>
          <Button
            type="submit"
            // 분류는 필수입니다
            disabled={category === null || title.trim().length === 0}
          >
            포스팅
          </Button>
        </div>

        <p className="text-ink-muted text-[10.5px] leading-relaxed">
          분류는 필수입니다. 컬렉션 첨부는 컬렉션 공유를 골랐을 때만 나타나고,
          관련 향수와 이미지는 없어도 됩니다.
        </p>
      </form>

      {/*
        후보 목록은 이 화면에서 넘깁니다. features 끼리는 import 할 수 없으므로
        향수 검색 결과를 여기서 조합해야 합니다.
        TODO: 향수 검색 API 연결
      */}
      <PerfumePickModal
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
    </div>
  )
}
