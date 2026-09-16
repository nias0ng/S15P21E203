import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRef, useState, type ReactNode } from 'react'

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
  ShelfDeck,
  ShelfDetailPanel,
  ShelfFooterStrip,
  ShelfPager,
  ShelfRegisterModal,
  ShelfSaveModal,
  ShelfToolbar,
  ShelfWall,
  shelfItemsQuery,
  shelfKeys,
  toPerfumeOption,
  useShelfArrangement,
  useShelfBrowser,
  type ShelfCategory,
  type ShelfItem,
  type ShelfWallHandle,
} from '@/features/shelf'
import { useToast } from '@/shared/hooks/useToast'
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
 * 2) 활자 중 두 무대의 제목(나의 진열대 · 내 컬렉션)만 임의 크기(text-[36px])입니다.
 *    시안의 제목이 36px 인데 스케일의 최대치인 text-display 가 28px 이라 어느 토큰으로도
 *    그 크기가 나오지 않습니다. 이 화면에서 가장 큰 글자라 한 단만 어긋나도 위계가 눈에
 *    띄게 달라져 여기만 값을 적고 나머지 활자는 전부 토큰을 씁니다. leading-[1.2] 는
 *    --text-display--line-height 와 같은 비율이라 스케일을 벗어난 값이 아닙니다.
 *    휴대폰 폭에서는 36px 제목이 한 줄을 다 차지해서 스케일 최대치(text-display)로 둡니다.
 *
 * 간격 · 치수는 1920 기준으로 끝자리를 0 또는 5 로 맞춥니다(styles/index.css 의
 * 화면 폭 주석). 글자 크기는 이 규칙에서 빠지고 위 2)대로 둡니다.
 * 전환(duration+ease)은 규약 그대로입니다. 포커스 링도 굵기 ·
 * 오프셋 폭은 규약 그대로이고, 크림 바탕 때문에 링과 오프셋 **색**만 이 화면
 * 팔레트로 맞춥니다.
 *
 * 폭은 라우트에 full 로 적혀 있어 화면 틀 전체(1920 에서 1800)를 씁니다. 진열장이
 * 목록 카드만 한 폭에 갇히면 "미술관 진열장" 이라는 화면의 성격이 사라집니다.
 */

type Stage = 'shelf' | 'collection'

/** 두 무대의 제목. 휴대폰 폭에서는 스케일 최대치(28px), 태블릿 폭부터 시안의 36px(위 2) */
const STAGE_TITLE =
  'font-serif text-display font-semibold md:text-[36px] md:leading-[1.2]'

/**
 * 나의 진열대 (A13 재디자인 시안)
 *
 * 화면 폭에 따라 **배치가 둘**입니다(features/shelf 의 useShelfArrangement).
 *
 * ── 한 장 배치(1024~) ────────────────────────────────────
 * **스크롤하지 않는 한 장입니다.** 헤더 아래를 두 무대가 나눠 쓰고, 하단 띠의 단추로
 * 위아래로 바뀝니다(ShelfDeck).
 *
 *   진열대     분류마다 벽감을 하나씩 가로로 이어 붙인 벽(ShelfWall). 휠로 좌우로 흐르고,
 *              칩을 누르면 그 분류의 첫머리로 갑니다. 고른 향수는 벽 위 오른쪽 패널에
 *              펼쳐지고, 하단 페이저로 벽 순서대로 한 병씩 넘길 수 있습니다.
 *   내 컬렉션  예전에는 진열대 아래로 스크롤해야 나왔습니다. 화면을 한 장으로 고정하면서
 *              아래에서 올라오는 무대로 옮겼습니다.
 *
 * 머리말 부제 · 영문 문구와 하단 문구를 걷어낸 세로 공간은 진열장이 씁니다 — 벽감
 * 크기를 고정값이 아니라 남은 공간에서 계산합니다(features/shelf 의 shelfLayout).
 * 세로가 아주 낮은 창에서는 한 장의 최소 높이(650)를 지키고 페이지가 조금 스크롤됩니다.
 * 그보다 줄이면 상세 패널 글자가 읽히지 않는 크기로 줄어듭니다.
 *
 * ── 쌓는 배치(~1023, 태블릿 · 휴대폰) ─────────────────────────
 * 패널을 벽 위에 얹을 자리가 없어서 억지로 줄이지 않고 위에서 아래로 이어 세웁니다.
 * 페이지가 세로로 스크롤됩니다.
 *
 *   제목 → 칩 · 드롭다운(옆으로 밀림) → 검색 → 벽(화면 폭 가득, 손가락으로 끌기)
 *   → 페이저 → 상세 카드(넓으면 두 단) → 내 컬렉션
 *
 * 진열대와 컬렉션은 서로 다른 도메인입니다. features 끼리는 import 할 수 없으므로
 * 이 화면에서 두 도메인을 조합합니다.
 */
export default function MyShelfPage() {
  const shelf = useQuery(shelfItemsQuery())
  const collections = useQuery(myCollectionsQuery())
  const arrangement = useShelfArrangement()
  const queryClient = useQueryClient()

  const [stage, setStage] = useState<Stage>('shelf')
  const [registerOpen, setRegisterOpen] = useState(false)
  const [createCollectionOpen, setCreateCollectionOpen] = useState(false)
  const [changeCategoryOpen, setChangeCategoryOpen] = useState(false)
  const [removeOpen, setRemoveOpen] = useState(false)
  const { showToast, toastProps } = useToast()

  // 검색어 · 선택 · 칩은 서로 규칙이 걸려 있어 한 훅이 함께 들고 있습니다.
  const browser = useShelfBrowser(shelf.data ?? [])
  const wall = useRef<ShelfWallHandle>(null)

  // 담은 향수가 적으면 아예 묻지 않습니다 — 개인화를 말할 근거가 없습니다
  const shelfCount = shelf.data?.length ?? 0
  const recommendation = useQuery({
    ...personalRecommendationQuery(),
    enabled: shelfCount >= RECOMMEND_MIN_SHELF_ITEMS,
  })

  if (shelf.isPending) return <PageFallback />

  const collectionCount = collections.data?.length ?? 0

  /*
   * 분류로 가기 — 칩과 벽의 이름표가 같은 곳으로 보냅니다. 그 분류의 첫 향수를 고르고,
   * 벽을 그 분류의 첫머리(이름표가 창 왼쪽 끝)로 흘립니다. 둘이 따로 적히면 한쪽만
   * 첫 향수를 골라서, 같은 분류로 갔는데 상세 패널이 다르게 남습니다.
   */
  const showCategory = (category: ShelfCategory) => {
    browser.selectFirstOf(category)
    wall.current?.showCategory(category)
  }

  /*
   * 두 배치가 같은 조각을 다른 자리에 놓습니다. 조각은 여기서 한 번만 적습니다 —
   * 배치마다 따로 적으면 한쪽만 고쳐져 두 배치가 조용히 달라집니다.
   */
  const toolbar = (className?: string) => (
    <ShelfToolbar
      counts={browser.counts}
      value={browser.viewCategory}
      onChange={showCategory}
      keyword={browser.keyword}
      onKeywordChange={browser.changeKeyword}
      className={className}
    />
  )

  const shelfWall = (className: string, aside?: ReactNode) => (
    <ShelfWall
      ref={wall}
      sections={browser.sections}
      selectedId={browser.selected?.shelfItemId ?? null}
      onSelect={browser.select}
      onViewCategoryChange={browser.changeViewCategory}
      onPlaqueSelect={showCategory}
      resetKey={browser.keyword}
      emptyMessage={
        browser.keyword
          ? '조건에 맞는 향수가 없습니다'
          : '아직 담은 향수가 없습니다'
      }
      className={className}
      aside={aside}
    />
  )

  /*
   * 고른 향수 한 개를 고쳐 씁니다.
   *
   * ⚠️ 백엔드 진열대 API 가 아직 없어서(features/shelf 의 api.ts) 고친 값이 **쿼리
   * 캐시에만** 남습니다 — 새로고침하면 사라집니다. 그래도 화면에 반영은 해야 합니다.
   * 토스트만 띄우고 끝내면 별을 눌러도 별이 안 채워지고 원을 눌러도 원이 안 차서,
   * 눌러 본 사람이 "고장났다" 고 읽습니다.
   *
   * 서버 데이터라 Zustand 가 아니라 쿼리 캐시에 씁니다(CLAUDE.md 의 서버 상태 vs
   * 클라이언트 상태). API 가 붙으면 이 함수가 useMutation 의 낙관적 갱신(onMutate)
   * 자리로 그대로 옮겨갑니다.
   */
  const patchSelected = (patch: (item: ShelfItem) => ShelfItem) => {
    const id = browser.selected?.shelfItemId
    if (id === undefined) return
    queryClient.setQueryData<ShelfItem[]>(shelfKeys.items(), (items) =>
      items?.map((item) => (item.shelfItemId === id ? patch(item) : item)),
    )
  }

  const detail = (className?: string) => (
    /*
      key 로 향수마다 패널을 새로 만듭니다. 안 그러면 메모 입력칸이 이전
      향수의 글을 그대로 들고 있어서, 병을 바꾼 줄 모르고 남의 메모를 고치게
      됩니다.
    */
    <ShelfDetailPanel
      key={browser.selected?.shelfItemId ?? 'empty'}
      item={browser.selected}
      onSetRepresentative={() => {
        // TODO: SHF-05 대표 향수 지정 API 연결
        const id = browser.selected?.shelfItemId
        if (id === undefined) return
        // 대표는 한 번에 하나라, 고른 향수만 켜고 나머지는 전부 내립니다
        queryClient.setQueryData<ShelfItem[]>(shelfKeys.items(), (items) =>
          items?.map((item) => ({
            ...item,
            representative: item.shelfItemId === id,
          })),
        )
        showToast('대표 향수로 지정했습니다')
      }}
      onChangeRating={(rating) => {
        // TODO: SHF-12 취향 적합도 저장 API 연결
        /*
          여기만 토스트를 띄우지 않습니다 — 원이 차는 것이 이미 답이고, 점수를
          맞춰 보느라 여러 번 누르게 되어 토스트가 연달아 뜹니다.
        */
        patchSelected((item) => ({ ...item, rating }))
      }}
      onChangeCategory={() => setChangeCategoryOpen(true)}
      onRemove={() => setRemoveOpen(true)}
      onSaveMemo={(memo) => {
        // TODO: SHF-10 메모 저장 API 연결
        patchSelected((item) => ({
          ...item,
          // 빈 글은 "메모 없음" 입니다 — 빈 문자열을 남기면 날짜만 붙은 빈 메모가 됩니다
          memo: memo || null,
          memoUpdatedAt: memo ? new Date().toISOString() : null,
        }))
        showToast('메모를 저장했습니다')
      }}
      className={className}
    />
  )

  const collectionHeader = (
    <div className="flex min-h-12.5 items-center gap-5">
      <h2 className={STAGE_TITLE}>내 컬렉션</h2>
      <span className="shelf-muted text-body tabular-nums">
        {collectionCount}개
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
  )

  const collectionStrip = (
    <CollectionStrip
      items={collections.data ?? []}
      isPending={collections.isPending}
      onCreate={() => setCreateCollectionOpen(true)}
    />
  )

  const dialogs = (
    <>
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
    </>
  )

  /*
    시안의 종이 바탕과 질감. fixed 로 뷰포트를 통째로 덮습니다 — 이 div 에만
    배경을 깔면 좌우 여백과 화면 아래쪽이 body 의 ivory 로 남아 종이 한 장
    느낌이 끊깁니다. -z-10 이라 본문 뒤, 헤더(bg-surface · z-20) 아래에 깔립니다.

    질감(shelf-grain)을 본문이 아니라 이 레이어에 얹는 이유: 노이즈는
    mix-blend-mode 로 밑을 곱하는데, 본문 위에 두면 새 쌓임 맥락이 생겨
    Toast(fixed)와 모달이 그 아래로 밀립니다.
  */
  const paper = (
    <div aria-hidden className="shelf-paper shelf-grain fixed inset-0 -z-10" />
  )

  /*
    추천할 것이 없으면 카드를 그리지 않습니다. 빈 카드를 띄워 "추천이 없습니다"
    라고 적으면, 사용자가 부르지도 않은 것이 나타나 아무 말도 안 하는 셈입니다.
    fixed 로 화면 왼쪽 가장자리에 붙으므로 두 배치 모두 무대 밖, 최상위 div 바로 안에 둡니다.
  */
  const recommendCard = recommendation.data && (
    <RecommendPeekCard recommendation={recommendation.data} />
  )

  if (arrangement === 'stacked') {
    return (
      <div className="shelf-scope flex flex-col">
        {paper}
        {recommendCard}

        <div className="flex flex-col gap-5">
          <h1 className={STAGE_TITLE}>나의 진열대</h1>
          {toolbar()}
        </div>

        {/*
          벽이 좌우 여백으로 스며 나가는 페이드를 본문 폭에서 자르지 않고 여백 바깥에서
          자릅니다(한 장 배치의 ShelfDeck 과 같은 이유). 자르지 않으면 옆으로 긴 벽이
          페이지 가로 스크롤을 만듭니다.

          높이는 화면 폭을 따릅니다 — 페이지가 스크롤되어 남는 세로 공간이라는 기준이
          없습니다. 휴대폰에서 병 셋, 태블릿에서 병 넷 남짓이 한 화면에 섭니다.
        */}
        <div className="-mx-[var(--gutter)] mt-7.5 overflow-x-clip px-[var(--gutter)]">
          {shelfWall('h-[clamp(380px,72vw,560px)]')}
        </div>

        <ShelfPager
          index={browser.index}
          total={browser.total}
          onPrev={() => browser.move(-1)}
          onNext={() => browser.move(1)}
          className="mt-2.5 self-end"
        />

        <div className="mt-5">{detail()}</div>

        <section aria-label="내 컬렉션" className="mt-15 flex flex-col gap-7.5">
          {collectionHeader}
          {collectionStrip}
        </section>

        {dialogs}
      </div>
    )
  }

  return (
    /*
      부모 <main> 의 세로 여백(pt-15 pb-15)을 걷어내고 뷰포트 높이에 맞춥니다.
      90px 은 헤더 높이(GlobalHeader 의 h-22.5)입니다. 헤더 높이를 바꾸면 여기도 함께
      바꿔야 페이지에 세로 스크롤이 생기지 않습니다.
      최소 높이 650 — 진열장 자리가 460 아래로 줄지 않는 높이입니다(위 한 장 배치 설명).
    */
    <div className="shelf-scope -mt-15 -mb-15 flex h-[calc(100dvh_-_90px)] min-h-162.5 flex-col">
      {paper}
      {recommendCard}

      {/*
        무대는 좌우 여백까지 넓혀 둡니다(-mx-[var(--gutter)]). 무대가 위아래로 바뀔 때
        넘친 것을 잘라야 하는데, 본문 폭에서 자르면 벽이 좌우 여백으로 스며 나가는
        페이드가 여백 경계에서 뚝 끊깁니다. 무대 안쪽은 같은 여백을 다시 두어 줄을 맞춥니다.
      */}
      <ShelfDeck
        index={stage === 'shelf' ? 0 : 1}
        className="-mx-[var(--gutter)] min-h-0 flex-1"
      >
        {[
          <div
            key="shelf"
            className="flex h-full flex-col px-[var(--gutter)] pt-10"
          >
            {/* 제목과 도구 줄이 한 줄에 놓입니다. 부제를 걷어내 한 줄 높이(50)입니다 */}
            <div className="flex min-h-12.5 items-center gap-10">
              <h1 className="shrink-0 font-serif text-[36px] leading-[1.2] font-semibold">
                나의 진열대
              </h1>
              {toolbar('flex-1')}
            </div>

            {shelfWall(
              'mt-7.5 flex-1',
              // 높이는 벽감 + 이름표 자리까지. 작은 화면에서는 벽감을 따라 통째로 줄어듭니다(ShelfWall)
              detail('flex-1'),
            )}
          </div>,

          /*
            내 컬렉션 — 시안에는 없지만 A13 의 아래 절반이라 지우지 않고 둡니다.
            진열대 무대와 같은 자리에 같은 크기의 제목을 둬서, 바뀔 때 제목이 같은
            줄에서 갈려 올라옵니다. 컬렉션이 많아 넘치면 이 무대 안에서만 스크롤합니다.
          */
          <div
            key="collection"
            className="flex h-full flex-col px-[var(--gutter)] pt-10"
          >
            {collectionHeader}

            <div className="mt-7.5 min-h-0 flex-1 overflow-y-auto pb-7.5">
              {collectionStrip}
            </div>
          </div>,
        ]}
      </ShelfDeck>

      <ShelfFooterStrip
        view={stage}
        onToggleView={() => {
          // 무대가 바뀌기 직전에 벽의 이름표에 아래에서 바람을 일으킵니다 — 진열대가 위로 빠질 때는 세게,
          // 돌아올 때는 조금 약하게 들렸다 가라앉습니다(ShelfWall 의 gust). 쌓는 배치에는 무대가 없어 부르지 않습니다
          wall.current?.gust(stage === 'shelf' ? 'leave' : 'arrive')
          setStage(stage === 'shelf' ? 'collection' : 'shelf')
        }}
        collectionCount={collectionCount}
        index={browser.index}
        total={browser.total}
        onPrev={() => browser.move(-1)}
        onNext={() => browser.move(1)}
      />

      {dialogs}
    </div>
  )
}
