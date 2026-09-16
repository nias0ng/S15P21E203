import { useState } from 'react'
import { useSearchParams } from 'react-router'

import { ImageAttachField, WriteForm } from '@/features/community'
// 계절은 향수 도메인의 어휘입니다. features/community 는 features/perfume 를
// import 할 수 없으므로(ESLint) 화면에서 두 도메인을 조합합니다.
import { SEASONS, type Season } from '@/features/perfume'
import { ROUTES } from '@/shared/config/routes'
import { cn } from '@/shared/lib/cn'
import { Button } from '@/shared/ui/Button'
import { ChipToggle } from '@/shared/ui/ChipToggle'
import { Input } from '@/shared/ui/Input'
import { Textarea } from '@/shared/ui/Textarea'

/**
 * 후기 게시글 작성 · 수정 (와이어프레임 A24a — CMT-03 · CMT-06)
 *
 * 분류가 없고(전부 후기라서) 대상 향수는 필수 · 한 개만입니다.
 * 향수 상세에서 오면 `?perfumeId=` 를 달고 와서 이미 채워져 있습니다.
 */
export default function ReviewWritePage() {
  const [searchParams] = useSearchParams()
  const preselectedId = searchParams.get('perfumeId')

  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [seasons, setSeasons] = useState<Season[]>([])

  // TODO: perfumeId 로 향수를 조회해 이름 · 브랜드를 채우세요 (화면에서 조합)
  const targetPerfume = preselectedId
    ? { name: '조 말론 우드 세이지', brand: '조 말론 런던' }
    : null

  return (
    <WriteForm
      title="후기 쓰기"
      description="대상 향수는 필수이고 한 개만 답니다. 후기에는 분류가 없습니다."
      cancelTo={ROUTES.COMMUNITY_REVIEWS}
      submitLabel="포스팅"
      submitDisabled={!targetPerfume || title.trim().length === 0}
      onSubmit={() => {
        // TODO: CMT-03 포스팅 API 연결. 성공하면 게시글 상세로 이동합니다
        // TODO: DTL-16 계절 등록 API 연결 — 위 seasons 를 함께 보냅니다
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
          <Button variant="outline" size="sm" type="button" className="ml-auto">
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

      {/*
          계절별 평가 (DTL-16). 예전에는 향수 상세의 [계절 등록] 단추가 모달을
          띄웠는데, 이 향을 어느 계절에 맡았는지는 후기와 같은 순간에 남기는
          값이라 여기로 옮겼습니다. 입구가 둘이면 한쪽만 쓰이고 다른 쪽은
          잊힙니다.

          네 칸을 같은 폭으로 늘여 한 줄에 놓습니다. 칩이 글자 폭대로 떨어져
          있으면 "봄" 과 "여름" 의 크기가 달라 고르는 대상이 아니라 태그처럼
          보입니다.

          여러 개 고를 수 있습니다 — 봄과 가을에 다 어울리는 향이 있습니다.
        */}
      <fieldset className="space-y-2">
        <legend className="text-ink text-caption font-medium">
          계절별 평가 <span className="text-ink-muted">(선택)</span>
        </legend>
        <ChipToggle
          label="이 향이 잘 어울리는 계절"
          multiple
          tone="warm"
          options={SEASONS}
          value={seasons}
          onChange={setSeasons}
          className="grid grid-cols-4 gap-2"
        />
      </fieldset>

      <ImageAttachField />
    </WriteForm>
  )
}
