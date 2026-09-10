import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'

import {
  CollectionFormModal,
  CollectionStrip,
  myCollectionsQuery,
} from '@/features/collection'
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
 *    팔레트입니다. 근거는 그 파일 머리말에 한 번만 적어 두었습니다 — 요약하면,
 *    Museum Archive 의 ivory 는 시안의 크림보다 밝고 차가워서 그대로 얹으면
 *    진열장과 바탕의 명도 차가 사라져 진열장이 종이에 묻힙니다. @theme 을 시안에
 *    맞추면 진열대와 무관한 화면 색까지 전부 함께 움직이므로, **시안 확정 전
 *    프로토타입인 이 화면에 한해** 스코프 CSS 로 가둡니다.
 *    스타일시트는 `@/features/shelf` 가 함께 싣습니다(그 index.ts 주석 참고).
 *
 * 2) 활자 중 제목 하나만 임의 크기(text-[36px])입니다. 시안의 제목이 36px 인데
 *    스케일의 최대치인 text-display 가 28px 이라 어느 토큰으로도 그 크기가 나오지
 *    않습니다. 이 화면에서 가장 큰 글자라 한 단만 어긋나도 위계가 눈에 띄게
 *    달라져 여기만 값을 적고 나머지 활자는 전부 토큰을 씁니다. leading-[1.2] 는
 *    --text-display--line-height 와 같은 비율이라 스케일을 벗어난 값이 아닙니다.
 *
 *    자간(tracking-[0.18em])도 @theme 에 토큰이 없어 임의값입니다 — 값을 쓰는
 *    자리에 이유를 적어 두었습니다.
 *
 * 간격(4의 배수)과 전환(duration+ease)은 규약 그대로입니다. 포커스 링도 굵기 ·
 * 오프셋 폭은 규약 그대로이고, 크림 바탕 때문에 링과 오프셋 **색**만 이 화면
 * 팔레트로 맞춥니다.
 */

/**
 * 부모 <main> 의 max-w-content(1120px) 제약을 이 화면에서만 깹니다.
 *
 * 시안의 진열장은 뷰포트 폭의 76%(1440 기준 1099px)를 쓰고 그 오른쪽에 패널이 또 한 칸
 * 붙습니다. 1120px 안에 우겨넣으면 진열장이 목록 카드만 해지고, 병 130px + 간격 24px
 * 기준으로 다섯 개밖에 안 서서 "미술관 진열장" 이라는 화면의 성격 자체가 사라집니다.
 * RootLayout 주석도 화면을 꽉 채워야 하는 화면은 페이지 안에서 폭 제한을 벗어난다고
 * 적어 두었습니다.
 *
 * 계산: 폭은 좌우 32px 여백을 뺀 값이되 1560px 을 넘지 않고, 좌우 마진
 * calc(50% - 폭/2) 가 부모 중앙을 기준으로 다시 가운데를 잡습니다(부모가 이미
 * mx-auto 라 결과는 뷰포트 정중앙입니다).
 *
 * 흔한 `left-1/2 -translate-x-1/2` 대신 마진으로 미는 이유: 이 div 안에 Toast(fixed)가
 * 들어 있어서 조상에 transform 이 생기면 토스트가 뷰포트가 아니라 이 상자를 기준으로
 * 붙습니다. w-screen 을 쓰지 않은 이유도 같은 종류입니다 — 100vw 는 세로 스크롤바
 * 폭까지 세어 아래 "내 컬렉션" 이 생기는 순간 가로 스크롤이 납니다.
 */
const FULL_BLEED =
  'w-[min(1560px,calc(100vw_-_4rem))] mx-[calc(50%_-_min(780px,calc(50vw_-_2rem)))]'

/**
 * 나의 향 컬렉션 (A13 재디자인 시안)
 *
 * 진열대 세 칸을 **진열장 하나로 합쳤습니다.** 분류는 상단 필터 칩으로 좁혀 봅니다.
 * 와이어프레임 A13 은 "칸은 세 개로 고정" 이었지만, 시안이 한 진열장에 모두 세우고
 * 칩으로 거르는 쪽으로 바뀌었습니다.
 *
 * 선택한 향수는 오른쪽 패널에 펼쳐집니다. 하단 페이저로도 넘길 수 있어서,
 * 병을 하나씩 눌러 보지 않아도 순서대로 훑을 수 있습니다.
 *
 * 진열대와 컬렉션은 서로 다른 도메인입니다. features 끼리는 import 할 수 없으므로
 * 이 화면에서 두 도메인을 조합합니다.
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

  if (shelf.isPending) return <PageFallback />

  return (
    // -my-8 로 부모 <main> 의 세로 여백(py-8)을 걷어내고 위아래를 따로 줍니다.
    //
    // 위 56px 은 시안 실측입니다 — 헤더 아래끝(88)과 제목 윗선(148)의 사이입니다.
    // 부모 여백(32)을 그대로 쓰면 16px 밖에 안 남아서 제목이 메뉴에 붙어 보입니다.
    // 아래는 하단 띠가 화면 안에 들어와야 해서 16px 만 줍니다.
    <div className={cn(FULL_BLEED, 'shelf-scope -my-8 pt-14 pb-4')}>
      {/*
        시안의 종이 바탕과 질감. fixed 로 뷰포트를 통째로 덮습니다 — 이 div 에만
        배경을 깔면 좌우 여백과 화면 아래쪽이 body 의 ivory 로 남아 종이 한 장
        느낌이 끊깁니다. -z-10 이라 본문 뒤, 헤더(bg-surface · z-20) 아래에 깔립니다.

        질감(shelf-grain)을 본문이 아니라 이 레이어에 얹는 이유: 노이즈는
        mix-blend-mode 로 밑을 곱하는데, 본문 위에 두면 새 쌓임 맥락이 생겨
        Toast(fixed)와 모달이 그 아래로 밀립니다.
      */}
      <div
        aria-hidden
        className="shelf-paper shelf-grain fixed inset-0 -z-10"
      />

      {/*
        여기부터 하단 문구까지가 시안의 "한 화면" 입니다. 화면이 남으면
        justify-between 이 남는 세로 공간을 세 덩어리 사이에 나눠, 하단 문구 줄이
        시안(y 865/941)처럼 화면 맨 아래에 붙습니다. 모자라면 그냥 gap-6 로 흐르고
        스크롤됩니다 — 높이를 고정해 내용을 잘라내지는 않습니다.
        10.5rem(168px)은 헤더 88 + 위 여백 56 + 아래 숨 24 입니다. 아래 24 가 없으면
        하단 띠가 화면 맨 끝에 딱 붙어서 잘린 것처럼 보입니다.
        헤더 높이나 위 여백을 바꾸면 여기도 함께 바꿔야 띠가 화면 밖으로 밀리지 않습니다.
      */}
      <section className="flex flex-col gap-4 lg:min-h-[calc(100dvh_-_10.5rem)] lg:justify-between">
        {/* 머리말과 필터가 한 줄에 놓입니다 (시안: 둘 다 y 145~190) */}
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
          {/*
            시안의 순서는 제목 → 부제 → 영문 문구입니다. 영문 문구가 맨 위에 있으면
            그게 화면의 제목처럼 읽혀서 시안 순서로 되돌렸습니다.
            제목·부제는 한 덩어리(gap-2)이고 영문 문구만 gap-6 으로 떨어뜨려
            "제목의 일부가 아니라 장식" 이라는 것을 간격으로 말합니다.
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
              여기만 `.shelf-label` 을 안 씁니다. 그 클래스는 대문자로 바꾸는 것까지
              함께 하는데, 이 문구는 이미 소문자로 적혀 있고 CSS 로 대문자를 만들면
              낭독기가 "E V E R Y" 처럼 한 글자씩 읽는 일이 생깁니다. 그래서 자간만
              같은 값으로 맞춥니다 — `.shelf-label` 의 0.18em 과 같은 값입니다.
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
            세 칸이 한 자리에서 위아래로 미끄러집니다. 안 보이는 칸도 미리 그려 두는
            이유는 넘어가는 동안 다음 칸이 올라오는 게 보여야 하기 때문입니다 —
            바뀔 때 만들면 빈 자리가 올라온 뒤에 병이 하나씩 나타납니다.
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
            폭 294px 과 lg:-mt-8 은 시안 실측입니다.

            폭: 시안의 패널이 294px 이고 오른쪽 여백이 32px 이라, 진열장에 남는 폭은
            1440 기준 1030px 입니다. 우리 FULL_BLEED(1440 에서 1376px)에서는
            1376 - 간격 16 - 294 = 1066px 이라 시안 비율과 거의 같습니다.

            위치: 시안에서 패널은 진열장보다 위에서 시작해(패널 y 177 · 진열장 y 266)
            필터 줄 바로 아래에 붙습니다. 음수 마진으로 그 차이를 흉내 내되, 필터 줄과
            겹치지 않을 만큼만 올립니다.
          */}
          {/*
            key 로 향수마다 패널을 새로 만듭니다. 안 그러면 메모 입력칸이 이전 향수의
            글을 그대로 들고 있어서, 병을 바꾼 줄 모르고 남의 메모를 고치게 됩니다.
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
          {/*
            굵기 · 오프셋 폭은 공용 버튼 규칙 그대로이고 링과 오프셋 **색**만 더합니다.
            `ring-offset-*` 의 기본색은 흰색이라, 이 크림 바탕 위에서는 링과 버튼 사이
            2px 이 흰 줄로 떠서 종이에 흰 자국이 난 것처럼 보입니다. 바탕을 토큰 밖 색으로
            바꾼 이 화면에서만 생기는 문제라 여기서 색을 맞춥니다 —
            ShelfDetailPanel 이 자기 카드 바탕에 대해 하는 것과 같습니다.
          */}
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
