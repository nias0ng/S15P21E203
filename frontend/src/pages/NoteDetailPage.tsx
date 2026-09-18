import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useParams } from 'react-router'

import { noteDetailQuery, notePerfumesQuery } from '@/features/note'
import { PerfumeGrid } from '@/features/perfume'
import { ROUTES } from '@/shared/config/routes'
import { Button } from '@/shared/ui/Button'
import { EmptyState } from '@/shared/ui/EmptyState'
import { LinkButton } from '@/shared/ui/LinkButton'
import { PageFallback } from '@/shared/ui/PageFallback'
import { Pagination } from '@/shared/ui/Pagination'
import { GLASS_PANEL } from '@/shared/ui/panel'
import { Thumbnail } from '@/shared/ui/Thumbnail'

/**
 * 노트 상세 (와이어프레임 A36 — A35 에서 노트를 누른 화면)
 *
 * 와이어프레임 주석:
 * - 노트 하나에 대분류 · 설명 · 그 노트가 들어간 향수 목록
 * - 향수 카드를 누르면 향수 상세(A10) · 향수가 많으면 스크롤로 이어 로드
 *
 * 향수 목록(A33) · 브랜드(A34 · 상세) · 노트 목록(A35) · 향수 상세(A10)와 같은
 * **어두운 방 + 유리판** 구성입니다. 어둠은 라우트의 `handle.night`(app/router)이
 * 켜고, 판은 아래 향수 격자가 `GLASS_PANEL` 로 답니다. 머리 구역은 판 없이 어둠에
 * 바로 놓입니다 — 브랜드 상세 · 향수 상세의 개요와 같은 이유로, 판을 두 장 쌓으면
 * 층이 안 읽힙니다.
 *
 * 어둠은 처음부터 켜져 있었는데 **이 화면만 유리판을 한 장도 안 썼습니다.** 사진 ·
 * 제목 · 격자가 어둠 위에 맨몸으로 떠 있었고, 대분류를 두르던 테두리 상자는 담긴
 * 글자가 두 어절뿐인 채로 본문 폭(1440) 끝까지 늘어났습니다.
 *
 * **설명 칸은 두지 않았습니다** — 백엔드 `notes` 표에 설명 컬럼이 없습니다.
 * 빈 상자를 두면 "아직 안 불러온 것" 처럼 보입니다. 컬럼이 생기면 되살립니다.
 *
 * 향수는 **쪽 넘김**입니다. 와이어프레임의 "스크롤로 이어 로드" 와 다르지만,
 * 인기 노트 하나에 향수가 수만 개 달려(머스크 49,571개) 이어 붙이면 끝이 없습니다.
 * 게시판 · 댓글과 같은 `Pagination` 을 씁니다.
 *
 * ⚠️ **브랜드 상세처럼 [향수 전체 보기]로 넘기지 못합니다.** 그쪽은 넘길 곳(향수
 * 검색 A09)이 있어 쪽 넘김을 걷어냈지만, 향수 검색 파라미터에는 `note` 가 없어
 * (features/perfume/types.ts 의 `PerfumeSearchParams`) 노트의 향수는
 * `/notes/{noteId}/perfumes` 에만 있습니다. 필터가 생기면 그때 같이 맞춥니다.
 */
export default function NoteDetailPage() {
  const { noteId } = useParams<{ noteId: string }>()
  const numericId = Number(noteId)
  const valid = Number.isFinite(numericId)

  const [page, setPage] = useState(0)

  /*
    노트를 옮겨 다니면(A36 → A35 → A36) 쪽 번호가 남습니다. 3쪽을 보다가 향수가
    20개뿐인 노트로 들어가면 빈 격자가 나옵니다. 렌더 중에 맞추는 이유는
    `useEffect` 로 한 박자 늦게 되돌리면 첫 프레임에 그 빈 격자가 보여서입니다.
  */
  const [pagedNoteId, setPagedNoteId] = useState(numericId)
  if (pagedNoteId !== numericId) {
    setPagedNoteId(numericId)
    setPage(0)
  }

  const note = useQuery({ ...noteDetailQuery(numericId), enabled: valid })
  const perfumes = useQuery({
    ...notePerfumesQuery(numericId, page),
    enabled: valid,
  })

  if (valid && note.isPending) return <PageFallback />

  // 없는 noteId 와 불러오기 실패를 같은 안내로 묶습니다 — 할 일이 같습니다
  if (!valid || note.isError || !note.data) {
    return (
      <EmptyState
        title="노트를 찾을 수 없습니다"
        description="주소를 다시 확인하거나 노트 목록에서 골라 주세요."
        action={
          <div className="flex justify-center gap-2.5">
            <Button variant="outline" onClick={() => note.refetch()}>
              다시 시도
            </Button>
            <LinkButton to={ROUTES.NOTES} size="sm">
              노트 목록
            </LinkButton>
          </div>
        }
      />
    )
  }

  const data = note.data

  return (
    <div className="space-y-6.25">
      {/*
        목적지를 이름으로 적습니다 — "뒤로 가기" 였을 때는 누르기 전에 어디로
        가는지 알 수 없었습니다. 브랜드 상세의 [← 브랜드 목록]과 같은 형식입니다.
      */}
      <LinkButton to={ROUTES.NOTES} variant="outline" size="sm">
        ← 노트 목록
      </LinkButton>

      {/*
        머리 구역을 **가운데 세우는** 이유는 브랜드 상세와 같습니다. 노트에도 소개글
        컬럼이 없어(features/note/types.ts) 왼쪽에 붙이면 오른쪽 절반이 통째로
        빕니다. 노트 목록의 검색창 · 대분류 알약도 가운데라, 목록에서 상세로 들어올
        때 시선이 같은 축에 머뭅니다.
      */}
      <header className="flex flex-col items-center gap-3.75 text-center">
        <Thumbnail
          src={data.imageUrl}
          fallback="노트 이미지"
          /*
            사진은 7:5 로 올라옵니다 — 목록 카드와 같은 비율이라 목록에서 들어오면
            같은 모양이 커지기만 합니다. 높이를 정하면 폭(224)은 비율이 정합니다.

            ⚠️ **바탕을 여기서 덮어씁니다.** `Thumbnail` 의 기본 상자는
            `bg-surface-sunken` 인데 `.scent-night` 는 이 토큰을 다시 정의하지
            않습니다 (styles/scent-display.css — 유리판 **안쪽**에서만 뒤집힙니다).
            그대로 두면 사진이 없거나 아직 안 받아졌을 때 어둠 위에 아이보리
            사각형이 남습니다. 브랜드 상세의 로고 판이 겪은 것과 같은 일입니다.

            브랜드처럼 흰 판을 깔지는 않습니다. 로고는 배경이 투명한 PNG 라 어둠에
            묻혔지만 노트 사진은 배경이 있는 jpg 라 그냥 얹어도 읽힙니다.
            테두리(`border-line`)는 어두운 방 값이 이미 흰색 반투명이라 둡니다.
          */
          className="aspect-7/5 h-40 shrink-0 bg-white/5"
        />

        <div className="space-y-2.5">
          {/* 이름 묶음은 바짝 붙입니다 — 둘은 "무엇의 무엇" 한 덩이입니다 */}
          <div className="space-y-0.5">
            {/*
              활자 스케일의 `text-title`(20)이 아니라 Tailwind 스케일의 36 입니다.
              브랜드 상세와 같은 사정입니다 — 머리에 담긴 것이 이름 하나뿐이라
              사진 · 액션과 무게를 나눠 갖지 않습니다. 20으로 두면 넓은 어둠
              한가운데 작은 글자 하나가 떠 있는 모양이었습니다.
            */}
            <h1 className="text-ink font-serif text-4xl font-semibold">
              {data.name}
            </h1>
            {/*
              한국어 이름이 없는 노트가 있습니다. 없으면 줄 자체를 그리지 않습니다.
              영문과 철자가 같은 노트도 빼서 같은 글자가 두 줄로 겹치지 않게 합니다.
            */}
            {data.nameKo && data.nameKo !== data.name && (
              <p className="text-ink-muted text-heading">{data.nameKo}</p>
            )}
          </div>

          {/*
            대분류. 브랜드 상세의 `향수 N개` 와 같은 자리 · 같은 크기입니다.

            **알약이 아니라 글자입니다.** 목록(A35)의 대분류 알약은 눌러서 거르는
            필터인데 여기서는 누를 곳이 없어, 같은 모양으로 두면 눌리지 않는 알약이
            됩니다. `대분류` 라는 말을 앞에 붙이는 이유는 `AMBER` 만 남기면 그게
            무엇의 값인지 알 수 없어서입니다 — 브랜드의 `향수 668개` 는 단위가
            그 일을 해줍니다.

            **많이 쓰이는 순위(`popularityRank`)는 적지 않습니다.** 그 순위는 "이
            노트를 쓴 향수가 몇 개인가" 로 줄을 세운 순서라, 바로 아래 유리판에
            적히는 개수가 그 값의 원본입니다. 둘을 같이 적으면 다른 이야기인 줄
            알고 한 번 더 읽게 됩니다. 목록도 이 값으로 줄만 세우고 적지는 않습니다.
          */}
          <p className="text-ink-muted text-caption">
            대분류 {data.accordFamily ?? '기타'}
          </p>
        </div>
      </header>

      {/*
        유리판. 향수 격자와 쪽 넘김이 이 판 위에 놓입니다 — 어두운 방 안의 밝은
        표면이라 판 안쪽은 색 토큰이 다시 정의됩니다
        (styles/scent-display.css 의 .scent-glass).
      */}
      <section className={GLASS_PANEL}>
        <div className="mb-6.25 flex items-baseline gap-2.5">
          {/* 판 위 제목은 브랜드 · 향수 · 노트 목록의 판과 같은 크기입니다 */}
          <h2 className="text-ink font-serif text-2xl">
            이 노트가 들어간 향수
          </h2>
          {/*
            개수를 **여기에만** 적습니다. 브랜드 상세는 머리에 이미 `향수 N개` 가
            있어 판 제목 옆에서 뺐는데, 노트는 머리에 개수를 안 적으므로 이 자리가
            유일합니다.

            불러오는 중에도, 0건일 때도 적지 않습니다. 0 이 잠깐 보였다 바뀌면
            눈에 띄고, 0건은 아래 안내가 이미 "향수가 없습니다" 라고 말하고
            있어서 제목 옆 `0개` 는 같은 말을 두 번 하는 것이 됩니다 — 브랜드
            목록의 판 제목도 같은 이유로 0건에서 개수를 뺍니다.

            자릿수 구분을 넣는 이유는 인기 노트가 다섯 자리여서입니다
            (머스크 49,571). 이 화면 말고는 네 자리를 넘는 개수가 없습니다.
          */}
          {!perfumes.isPending && !!perfumes.data?.totalElements && (
            <span className="text-ink-muted text-caption">
              {perfumes.data.totalElements.toLocaleString('ko-KR')}개
            </span>
          )}
        </div>

        {perfumes.isError ? (
          <EmptyState
            title="향수 목록을 불러오지 못했습니다"
            description="잠시 후 다시 시도해 주세요."
            action={
              <Button variant="outline" onClick={() => perfumes.refetch()}>
                다시 시도
              </Button>
            }
          />
        ) : (
          <>
            {/*
              **5열입니다.** 브랜드 상세는 6열이지만 그쪽은 `size=30` 을 직접 보내
              6으로 나눠떨어집니다. 여기는 백엔드 기본값인 20개가 와서(api.ts 가
              `size` 를 안 보냅니다) 6열로 두면 마지막 줄에 두 장만 남아 격자
              오른쪽이 잘린 것처럼 보입니다. 20은 5로 정확히 네 줄이고, 노트
              목록도 5열이라 목록에서 들어올 때 열 폭이 안 바뀝니다.
            */}
            <PerfumeGrid
              items={perfumes.data?.perfumes ?? []}
              isPending={perfumes.isPending}
              columns={5}
              empty={
                <EmptyState
                  title="이 노트를 쓴 향수가 없습니다"
                  description="다른 노트를 골라 보세요."
                />
              }
            />

            {/*
              응답이 오기 전에는 그리지 않습니다. `size` 를 0 으로 넘기면 쪽 수
              계산이 NaN 이 되어 쪽 번호가 깨진 채로 한 프레임 보입니다.
            */}
            {perfumes.data && (
              <Pagination
                className="mt-6.25"
                label="노트별 향수 페이지"
                page={page}
                size={perfumes.data.size}
                totalElements={perfumes.data.totalElements}
                onPageChange={setPage}
              />
            )}
          </>
        )}
      </section>
    </div>
  )
}
