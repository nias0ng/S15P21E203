import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'

import {
  CollectionFormModal,
  CollectionStrip,
  myCollectionsQuery,
} from '@/features/collection'
import {
  personalRecommendationQuery,
  RECOMMEND_MIN_SHELF_ITEMS,
  RecommendPeekCard,
} from '@/features/recommend'
import {
  DisplayCase,
  ShelfDeck,
  ShelfDetailPanel,
  ShelfFooterStrip,
  ShelfRegisterModal,
  ShelfSaveModal,
  ShelfToolbar,
  shelfItemsQuery,
  toPerfumeOption,
  useShelfBrowser,
} from '@/features/shelf'
import { useToast } from '@/shared/hooks/useToast'
import { cn } from '@/shared/lib/cn'
import { Button } from '@/shared/ui/Button'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { PageFallback } from '@/shared/ui/PageFallback'
import { Toast } from '@/shared/ui/Toast'

/*
 * ⚠️ 이 화면만 공통 규칙 두 가지를 벗어납니다 — 왜인가
 *
 * 1) 색이 @theme 토큰이 아니라 `features/shelf/shelf-display.css` 의 진열대 전용
 *    팔레트입니다. 근거는 그 파일 머리말에 있습니다. @theme 을 시안에 맞추면
 *    진열대와 무관한 화면 색까지 함께 움직이므로 **시안 확정 전인 이 화면에 한해**
 *    스코프 CSS 로 가둡니다.
 *
 * 2) 제목 하나만 임의 크기(text-[36px])입니다. 스케일의 최대치인 text-display 가
 *    28px 이라 시안의 36px 이 어느 토큰으로도 나오지 않습니다. 이 화면에서 가장 큰
 *    글자라 한 단만 어긋나도 위계가 달라져, 여기만 값을 적고 나머지는 토큰을 씁니다.
 *
 * 간격·전환은 규약 그대로입니다. 포커스 링도 굵기·오프셋 폭은 규약대로이고
 * 크림 바탕 때문에 **색**만 이 화면 팔레트로 맞춥니다.
 */

/**
 * 부모 <main> 의 max-w-content(1120px) 제약을 이 화면에서만 깹니다.
 *
 * 시안의 진열장은 뷰포트 폭의 76% 를 쓰고 오른쪽에 패널이 또 한 칸 붙습니다.
 * 1120px 안에 우겨넣으면 병이 다섯 개밖에 안 서서 "미술관 진열장" 이라는 성격이
 * 사라집니다.
 *
 * `left-1/2 -translate-x-1/2` 대신 마진으로 미는 이유: 이 div 안에 Toast(fixed)가
 * 있어서 조상에 transform 이 생기면 토스트가 뷰포트가 아니라 이 상자에 붙습니다.
 * w-screen 을 안 쓰는 이유도 같은 종류 — 100vw 는 세로 스크롤바 폭까지 세어
 * 아래 "내 컬렉션" 이 생기는 순간 가로 스크롤이 납니다.
 */
const FULL_BLEED =
  'w-[min(1560px,calc(100vw_-_4rem))] mx-[calc(50%_-_min(780px,calc(50vw_-_2rem)))]'

/**
 * 나의 향 컬렉션 (A13 재디자인 시안)
 *
 * 진열대 세 칸을 **진열장 하나로 합쳤습니다.** 분류는 상단 필터 칩으로 좁혀 봅니다.
 * 선택한 향수는 오른쪽 패널에 펼쳐지고, 하단 페이저로도 순서대로 훑을 수 있습니다.
 *
 * 진열대와 컬렉션은 서로 다른 도메인이라 features 끼리 import 할 수 없어
 * 이 화면에서 조합합니다.
 */
export default function MyShelfPage() {
  const shelf = useQuery(shelfItemsQuery())
  const collections = useQuery(myCollectionsQuery())

  const [registerOpen, setRegisterOpen] = useState(false)
  const [createCollectionOpen, setCreateCollectionOpen] = useState(false)
  const [changeCategoryOpen, setChangeCategoryOpen] = useState(false)
  const [removeOpen, setRemoveOpen] = useState(false)
  const { showToast, toastProps } = useToast()

  // 칩 · 검색어 · 선택 커서는 서로 규칙이 걸려 있어 한 훅이 함께 들고 있습니다.
  const browser = useShelfBrowser(shelf.data ?? [])

  /*
   * 개인화 추천 카드. 담은 향수가 적으면 아예 묻지 않습니다 — 한두 개 담은 사람의
   * 취향을 안다고 말하면 그 근거가 거짓이 되고, 쓸 수 없는 답을 받으려고 요청을
   * 보낼 이유도 없습니다.
   */
  const shelfCount = shelf.data?.length ?? 0
  const recommendation = useQuery({
    ...personalRecommendationQuery(),
    enabled: shelfCount >= RECOMMEND_MIN_SHELF_ITEMS,
  })

  if (shelf.isPending) return <PageFallback />

  return (
    // 부모 <main> 의 세로 여백을 걷어내고 위아래를 따로 줍니다. 위 56px 은 시안
    // 실측이고, 아래는 하단 띠가 화면 안에 들어와야 해서 16px 만 줍니다.
    <div className={cn(FULL_BLEED, 'shelf-scope -mt-14 -mb-16 pt-14 pb-4')}>
      {/*
        시안의 종이 바탕과 질감. fixed 로 뷰포트를 통째로 덮습니다 — 이 div 에만
        배경을 깔면 좌우 여백이 body 의 ivory 로 남아 종이 한 장 느낌이 끊깁니다.

        질감을 본문이 아니라 이 레이어에 얹는 이유: 노이즈가 mix-blend-mode 를 쓰는데
        본문 위에 두면 새 쌓임 맥락이 생겨 Toast(fixed)와 모달이 그 아래로 밀립니다.
      */}
      <div
        aria-hidden
        className="shelf-paper shelf-grain fixed inset-0 -z-10"
      />

      {/*
        추천할 것이 없으면 카드를 그리지 않습니다. 빈 카드를 띄워 "추천이 없습니다"
        라고 적으면, 사용자가 부르지도 않은 것이 나타나 아무 말도 안 하는 셈입니다.
      */}
      {recommendation.data && (
        <RecommendPeekCard recommendation={recommendation.data} />
      )}

      {/*
        여기부터 하단 문구까지가 시안의 "한 화면" 입니다. 화면이 남으면
        justify-between 이 남는 공간을 나눠 하단 문구가 맨 아래에 붙고, 모자라면
        그냥 흐르고 스크롤됩니다 — 높이를 고정해 내용을 잘라내지 않습니다.

        10.5rem 은 헤더 88 + 위 여백 56 + 아래 숨 24 입니다.
        **헤더 높이나 위 여백을 바꾸면 여기도 함께 바꿔야** 띠가 화면 밖으로 안 밀립니다.
      */}
      <section className="flex flex-col gap-4 lg:min-h-[calc(100dvh_-_10.5rem)] lg:justify-between">
        {/* 머리말과 필터가 한 줄에 놓입니다 (시안: 둘 다 y 145~190) */}
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
          {/*
            제목·부제는 한 덩어리이고 영문 문구만 떨어뜨려 "제목의 일부가 아니라
            장식" 이라는 것을 간격으로 말합니다.
          */}
          <header className="flex shrink-0 flex-col gap-4">
            <div className="flex flex-col gap-2">
              <h1 className="font-serif text-[36px] leading-[1.2] font-semibold">
                나의 향 컬렉션
              </h1>
              <p className="shelf-muted text-body">
                수집한 향들이 모여,
                <br />
                나라는 이야기가 됩니다.
              </p>
            </div>

            {/*
              여기만 `.shelf-label` 을 안 씁니다 — 그 클래스는 CSS 로 대문자를 만드는데,
              그러면 낭독기가 "E V E R Y" 처럼 한 글자씩 읽는 일이 생깁니다.
              자간만 `.shelf-label` 과 같은 값으로 맞춥니다.
            */}
            <p className="shelf-muted text-caption tracking-[0.18em] uppercase">
              Every scent
              <br />
              has a story
            </p>
          </header>

          {/*
            lg:pt-2 는 칩 줄(약 34px)의 가운데를 40px 제목의 가운데에 맞추는 값입니다.
            items-start 라 그냥 두면 칩이 제목 윗선에 붙어 한 줄로 안 읽힙니다.
          */}
          <ShelfToolbar
            counts={browser.counts}
            value={browser.category}
            onChange={browser.changeCategory}
            keyword={browser.keyword}
            onKeywordChange={browser.changeKeyword}
            className="flex-1 lg:pt-2"
          />
        </div>

        {/* 진열장과 상세 패널. 시안의 둘 사이가 17px 이라 gap-4 입니다 */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-4">
          {/*
            안 보이는 칸도 미리 그려 둡니다 — 바뀔 때 만들면 빈 자리가 올라온 뒤에
            병이 하나씩 나타납니다.
          */}
          <ShelfDeck
            index={browser.categoryIndex}
            onIndexChange={browser.changeCategoryIndex}
            className="min-w-0 flex-1"
          >
            {browser.sections.map((section) => {
              const active = section.category === browser.category
              return (
                <DisplayCase
                  key={section.category}
                  label={section.label}
                  items={section.items}
                  selectedId={
                    active ? (browser.selected?.shelfItemId ?? null) : null
                  }
                  onSelect={browser.select}
                  windowStart={active ? browser.windowStart : 0}
                  onPage={browser.pageWindow}
                  canPagePrev={active && browser.canPagePrev}
                  canPageNext={active && browser.canPageNext}
                />
              )
            })}
          </ShelfDeck>

          {/*
            폭 294px 과 lg:-mt-8 은 시안 실측입니다 — 시안에서 패널이 진열장보다 위에서
            시작해 필터 줄 바로 아래에 붙습니다. 음수 마진으로 그 차이를 흉내 내되
            필터 줄과 겹치지 않을 만큼만 올립니다.

            key 로 향수마다 패널을 새로 만듭니다. 안 그러면 메모 입력칸이 이전 향수의
            글을 들고 있어서, 병을 바꾼 줄 모르고 남의 메모를 고치게 됩니다.
          */}
          <ShelfDetailPanel
            key={browser.selected?.shelfItemId ?? 'empty'}
            item={browser.selected}
            onSetRepresentative={() => {
              // TODO: SHF-05 대표 향수 지정 API 연결
              showToast('대표 향수로 지정했습니다')
            }}
            onChangeCategory={() => setChangeCategoryOpen(true)}
            onRemove={() => setRemoveOpen(true)}
            onSaveMemo={() => {
              // TODO: SHF-10 메모 저장 API 연결
              showToast('메모를 저장했습니다')
            }}
            className="w-full shrink-0 lg:-mt-8 lg:w-[294px]"
          />
        </div>

        <ShelfFooterStrip
          index={browser.index}
          total={browser.total}
          onPrev={() => browser.move(-1)}
          onNext={() => browser.move(1)}
        />
      </section>

      {/*
        내 컬렉션 — 시안에는 없지만 A13 의 아래 절반이라 지우지 않고 그대로 둡니다.
        위 한 화면 구성이 깨지지 않게 하단 문구 줄 아래로 완전히 내리고, mt-16 으로
        "스크롤해서 만나는 다음 장" 이라는 것을 간격으로 알립니다.
      */}
      <section className="mt-16 space-y-4">
        <div className="flex items-center gap-2">
          <h2 className="text-title font-serif font-semibold">내 컬렉션</h2>
          <span className="shelf-muted text-caption">
            {collections.data?.length ?? 0}개
          </span>
          {/* 포커스 링 색만 이 화면 팔레트로 맞춥니다 (ShelfDetailPanel 의 FOCUS_RING 과 같은 이유) */}
          <Button
            variant="outline"
            size="sm"
            className="ml-auto focus-visible:ring-[var(--shelf-ink)] focus-visible:ring-offset-[var(--paper)]"
            onClick={() => setRegisterOpen(true)}
          >
            + 향수 등록
          </Button>
        </div>

        <CollectionStrip
          items={collections.data ?? []}
          isPending={collections.isPending}
          onCreate={() => setCreateCollectionOpen(true)}
        />
      </section>

      <ShelfRegisterModal
        open={registerOpen}
        onClose={() => setRegisterOpen(false)}
        // ⚠️ 아직 향수 검색 API 를 붙이지 않아 진열대에 있는 향수를 그대로 씁니다.
        options={(shelf.data ?? []).map(toPerfumeOption)}
        onSearch={() => {
          // TODO: SHF-01 향수 검색 연결
        }}
        onSubmit={() => {
          setRegisterOpen(false)
          showToast('진열대에 등록했습니다')
        }}
      />
      <CollectionFormModal
        open={createCollectionOpen}
        onClose={() => setCreateCollectionOpen(false)}
        onSubmit={() => {
          setCreateCollectionOpen(false)
          showToast('컬렉션을 만들었습니다')
        }}
      />
      {/*
        분류 변경. initialCategory 를 넘기면 같은 모달이 "저장" 이 아니라 "변경" 으로
        열립니다 (와이어프레임 C02 — "분류 변경은 A11 과 같은 구성").
      */}
      <ShelfSaveModal
        open={changeCategoryOpen}
        onClose={() => setChangeCategoryOpen(false)}
        initialCategory={browser.selected?.category ?? null}
        onSave={() => {
          // TODO: SHF-03 분류 변경 API 연결
          setChangeCategoryOpen(false)
          showToast('분류를 바꿨습니다')
        }}
      />

      {/* 되돌릴 수 없는 조작이라 확인을 받습니다 (공통 규칙 C01) */}
      <ConfirmDialog
        open={removeOpen}
        onClose={() => setRemoveOpen(false)}
        title={`'${browser.selected?.name ?? '향수'}' 를 진열대에서 뺄까요?`}
        description="적어둔 메모와 적합도도 함께 사라지고, 되돌릴 수 없습니다."
        confirmLabel="저장 해제"
        onConfirm={() => {
          // TODO: SHF-04 진열대 저장 해제 API 연결
          setRemoveOpen(false)
          showToast('진열대에서 뺐습니다')
        }}
      />
      <Toast {...toastProps} />
    </div>
  )
}
