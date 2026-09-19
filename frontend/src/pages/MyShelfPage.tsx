import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { useRef, useState, type ReactNode } from 'react'

import {
  collectionKeys,
  collectionPreviewsQuery,
  CollectionFormModal,
  CollectionStrip,
  createCollection,
  myCollectionsQuery,
  type CollectionInput,
} from '@/features/collection'
import { perfumeListQuery } from '@/features/perfume'
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
  ShelfToolbar,
  ShelfWall,
  shelfItemDetailQuery,
  shelfItemsQuery,
  ShelfEditModal,
  ShelfEditPartialError,
  ShelfRegisterPartialError,
  useShelfActions,
  useShelfArrangement,
  useShelfBrowser,
  type ShelfCategory,
  type ShelfItemDetail,
  type ShelfWallHandle,
} from '@/features/shelf'
import { isApiError } from '@/shared/api/http'
import { ROUTES } from '@/shared/config/routes'
import { useDiveReady } from '@/shared/hooks/useDiveReady'
import { useToast } from '@/shared/hooks/useToast'
import { useIsLoggedIn } from '@/shared/store/authStore'
import { Button } from '@/shared/ui/Button'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { EmptyState } from '@/shared/ui/EmptyState'
import { LinkButton } from '@/shared/ui/LinkButton'
import { LoginRequiredDialog } from '@/shared/ui/LoginRequiredDialog'
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
  /*
   * 메인에서 잠수로 들어왔으면 커튼이 짙은 남색으로 덮은 채 이 신호를 기다립니다
   * (안 알려도 1.5초 상한에 걷힙니다 — shared/ui/DiveCurtain).
   *
   * 기준은 **목록**입니다. 이게 오면 벽과 벽감이 서고, 병 사진은 받은 것부터 차례로
   * 드러납니다(`useBottlePreload`) — 사진까지 기다리면 커튼이 늘 상한까지 서 있습니다.
   * 아래 `shelf.isPending` 이 스피너로 갈리는 바로 그 조건입니다.
   */
  useDiveReady(!shelf.isPending)
  const arrangement = useShelfArrangement()
  // 낙관적 갱신과 되돌리기는 도메인 훅이 들고 있습니다. 토스트만 여기서 붙입니다
  const actions = useShelfActions()
  const queryClient = useQueryClient()

  const [stage, setStage] = useState<Stage>('shelf')
  const [registerOpen, setRegisterOpen] = useState(false)
  const [registerKeyword, setRegisterKeyword] = useState('')
  const [loginOpen, setLoginOpen] = useState(false)
  const isLoggedIn = useIsLoggedIn()
  const [createCollectionOpen, setCreateCollectionOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [removeOpen, setRemoveOpen] = useState(false)
  const { showToast, toastProps } = useToast()

  // 검색어 · 선택 · 칩은 서로 규칙이 걸려 있어 한 훅이 함께 들고 있습니다.
  const browser = useShelfBrowser(shelf.data ?? [])
  const wall = useRef<ShelfWallHandle>(null)

  /*
   * 고른 한 병의 상세. 적합도 · 메모 · 향조는 목록에 없고 여기에만 있습니다.
   *
   * 카드를 넘길 때마다 한 번씩 부르지만 병마다 캐시가 따로 남아 오가면 즉시 뜹니다.
   */
  const selectedId = browser.selected?.shelfItemId
  const selectedDetail = useQuery({
    ...shelfItemDetailQuery(selectedId ?? 0),
    enabled: selectedId !== undefined,
  })

  /*
   * 패널에 넘길 값. **상세가 오기 전에는 목록이 아는 만큼으로 채웁니다** — 이름 ·
   * 브랜드 · 사진은 목록에 이미 있어 그대로 보이고, 적합도 · 메모만 뒤늦게 찹니다.
   * 상세를 기다렸다 그리면 카드를 넘길 때마다 패널이 통째로 비어 번쩍입니다.
   */
  const detailReady =
    selectedDetail.data !== undefined &&
    selectedDetail.data.shelfItemId === selectedId
  const panelItem: ShelfItemDetail | null =
    browser.selected === null
      ? null
      : detailReady
        ? selectedDetail.data
        : {
            ...browser.selected,
            nameKo: null,
            rating: null,
            memo: null,
            memoUpdatedAt: null,
            scentNotes: [],
          }

  /*
   * 등록 모달 1단계의 후보 (SHF-01).
   *
   * 향수 도메인과 진열대 도메인은 서로 import 할 수 없어 **화면이 조합합니다.**
   *
   * 검색어를 치기 전에는 부르지 않습니다 — 글에 향수를 거는 모달(`PostWritePage` ·
   * `ReviewWritePage`)과 같은 규칙입니다. 예전에는 열자마자 불러서 "고를 것이 있게"
   * 했는데, 백엔드 기본 정렬이 `sort = "id"` 라 그 20개는 카탈로그 7,793개 중 번호가
   * 빠른 스물이었습니다. 고를 향수가 아니라 그냥 목록입니다.
   */
  const candidates = useQuery({
    ...perfumeListQuery({ keyword: registerKeyword, size: 20 }),
    enabled: registerOpen && registerKeyword.trim().length > 0,
  })

  // 담은 향수가 적으면 아예 묻지 않습니다 — 개인화를 말할 근거가 없습니다
  const shelfCount = shelf.data?.length ?? 0
  const recommendation = useQuery({
    ...personalRecommendationQuery(),
    enabled: shelfCount >= RECOMMEND_MIN_SHELF_ITEMS,
  })

  /*
   * 컬렉션 카드에 얹을 향수 사진.
   *
   * ⚠️ 목록 응답에 썸네일이 없어 **컬렉션마다 상세를 한 번씩** 부릅니다. 캐시는
   * 상세 화면과 같은 키라, 카드를 눌러 들어가면 요청이 다시 나가지 않습니다.
   * BE 가 목록에 `previewThumbnails` 를 실어 주면 이 블록을 통째로 지웁니다.
   */
  const collectionIds = (collections.data ?? []).map(
    (item) => item.collectionId,
  )
  const collectionDetails = useQueries({
    queries: collectionPreviewsQuery(collectionIds),
  })

  /** 카드에 넘길 목록 — 미리보기만 상세에서 가져와 채웁니다 */
  const collectionCards = (collections.data ?? []).map((item, index) => {
    const detail = collectionDetails[index]?.data
    return detail === undefined
      ? item
      : { ...item, previewThumbnails: detail.previewThumbnails }
  })

  /**
   * 컬렉션 만들기 (COL-01).
   *
   * 만든 뒤 상세로 보내지 않습니다 — 진열대 하단 띠에 바로 나타나고, 방금 만든
   * 사람은 대개 향수를 더 담기보다 진열대를 계속 보기 때문입니다.
   */
  const createCollectionMutation = useMutation({
    mutationFn: ({
      input,
      shelfItemIds,
    }: {
      input: CollectionInput
      shelfItemIds: number[]
    }) => createCollection(input, shelfItemIds),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: collectionKeys.mine() })
      showToast('컬렉션을 만들었습니다')
    },
    onError: (error) =>
      showToast(
        // 이름이 겹치면 409 입니다
        isApiError(error) ? error.message : '컬렉션을 만들지 못했습니다',
      ),
  })

  if (shelf.isPending) return <PageFallback />

  /*
   * 목록을 못 받았으면 **빈 진열대로 그리지 않습니다.**
   *
   * 예전에는 `shelf.data ?? []` 로 넘어가 아무 말 없이 빈 벽이 나왔습니다. 방금
   * 등록한 사람은 "등록했습니다" 토스트를 보고 빈 벽을 보게 되어, 저장이 안 된
   * 것으로 읽습니다 — 실제로는 저장됐고 못 읽어 온 것뿐입니다.
   *
   * 분류 세 칸을 한꺼번에 받기 때문에(api.ts) 하나만 실패해도 여기로 옵니다.
   */
  if (shelf.isError) {
    /*
      비로그인은 "실패" 가 아니라 아직 안 한 일입니다. 같은 에러 문구로 묶으면
      로그인만 하면 될 사람에게 고장난 것처럼 보입니다.
    */
    if (!isLoggedIn) {
      return (
        <EmptyState
          title="로그인하면 진열대를 볼 수 있습니다"
          description="담아 둔 향수와 메모는 계정에 저장됩니다."
          action={
            <LinkButton to={ROUTES.LOGIN} variant="outline" size="sm">
              로그인하러 가기
            </LinkButton>
          }
        />
      )
    }

    return (
      <EmptyState
        title="진열대를 불러오지 못했습니다"
        description={
          isApiError(shelf.error)
            ? shelf.error.message
            : '잠시 후 다시 시도해주세요.'
        }
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={() => void shelf.refetch()}
          >
            다시 시도
          </Button>
        }
      />
    )
  }

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
  /*
    진열대에 담는 단추라 진열대 도구 줄에 섭니다 (와이어프레임 A13).
    "내 컬렉션" 머리말에 있던 것을 옮겼습니다 — 그쪽은 무대를 바꿔야 나오는 자리라
    진열대를 보는 동안에는 담을 방법이 화면에 없었습니다.

    굵기 · 오프셋 폭은 공용 버튼 규칙 그대로이고 링과 오프셋 **색**만 더합니다.
    `ring-offset-*` 의 기본색은 흰색이라, 이 크림 바탕 위에서는 링과 버튼 사이
    2px 이 흰 줄로 떠서 종이에 흰 자국이 난 것처럼 보입니다. 바탕을 토큰 밖 색으로
    바꾼 이 화면에서만 생기는 문제라 여기서 색을 맞춥니다 —
    ShelfDetailPanel 이 자기 카드 바탕에 대해 하는 것과 같습니다.
  */
  const registerButton = (
    <Button
      variant="outline"
      size="sm"
      className="focus-visible:ring-[var(--shelf-ink)] focus-visible:ring-offset-[var(--paper)]"
      /*
        비로그인이면 등록 모달 대신 로그인 유도 모달입니다 (공통 규칙 C01).
        진열대 API 는 전부 로그인이 필요해, 그냥 열면 향수를 고르고 분류까지
        정한 뒤 401 로 튕깁니다.
      */
      onClick={() => (isLoggedIn ? setRegisterOpen(true) : setLoginOpen(true))}
    >
      + 향수 등록
    </Button>
  )

  const toolbar = (className?: string) => (
    <ShelfToolbar
      counts={browser.counts}
      value={browser.viewCategory}
      onChange={showCategory}
      keyword={browser.keyword}
      onKeywordChange={browser.changeKeyword}
      action={registerButton}
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

  const detail = (className?: string) => (
    /*
      key 로 향수마다 패널을 새로 만듭니다. 안 그러면 메모 입력칸이 이전
      향수의 글을 그대로 들고 있어서, 병을 바꾼 줄 모르고 남의 메모를 고치게
      됩니다.
    */
    <ShelfDetailPanel
      /*
        상세가 도착하면 key 가 바뀌어 한 번 다시 만들어집니다. 메모 입력칸이
        첫 렌더의 값을 useState 초기값으로 들고 있어서, 안 바꾸면 목록만 알던
        때의 빈 메모가 그대로 남습니다.
      */
      key={`${browser.selected?.shelfItemId ?? 'empty'}:${detailReady ? 'full' : 'lite'}`}
      item={panelItem}
      onChangeRating={(rating) => {
        if (selectedId === undefined) return
        /*
          성공 토스트를 띄우지 않습니다 — 원이 차는 것이 이미 답이고, 점수를
          맞춰 보느라 여러 번 누르게 되어 토스트가 연달아 뜹니다.
          실패는 원이 되돌아가는 것만으로는 읽히지 않아 말해 줍니다.
        */
        actions.rating.mutate(
          { shelfItemId: selectedId, rating },
          { onError: () => showToast('적합도를 저장하지 못했습니다') },
        )
      }}
      onEdit={() => setEditOpen(true)}
      onRemove={() => setRemoveOpen(true)}
      className={className}
    />
  )

  const collectionHeader = (
    <div className="flex min-h-12.5 items-center gap-5">
      <h2 className={STAGE_TITLE}>내 컬렉션</h2>
      <span className="shelf-muted text-body tabular-nums">
        {collectionCount}개
      </span>
    </div>
  )

  /*
    컬렉션을 못 받았으면 빈 띠로 그리지 않습니다. 진열대 목록과 같은 이유 —
    아무 말이 없으면 "컬렉션이 하나도 없다" 로 읽히는데, 실제로는 못 읽어 온
    것입니다. 여기는 화면의 한 구역이라 진열대처럼 화면 전체를 대신하지 않고
    띠 자리에만 안내를 둡니다.
  */
  const collectionStrip = collections.isError ? (
    <div className="border-line rounded-card flex min-h-40 flex-col items-center justify-center gap-2.5 border border-dashed">
      <p className="shelf-muted text-caption">컬렉션을 불러오지 못했습니다</p>
      <Button
        variant="outline"
        size="sm"
        onClick={() => void collections.refetch()}
      >
        다시 시도
      </Button>
    </div>
  ) : (
    <CollectionStrip
      items={collectionCards}
      isPending={collections.isPending}
      onCreate={() => setCreateCollectionOpen(true)}
    />
  )

  /** 이미 담은 향수 번호. 등록 모달이 중복 선택을 막는 데 씁니다 */
  const inShelf = new Set((shelf.data ?? []).map((item) => item.perfumeId))

  const dialogs = (
    <>
      <ShelfRegisterModal
        open={registerOpen}
        onClose={() => setRegisterOpen(false)}
        /*
          향수 검색 결과를 진열대가 아는 모양으로 옮깁니다. 이미 담은 향수는
          `alreadyInShelf` 로 표시돼 고를 수 없습니다 — 골라 봐야 409 입니다.
        */
        options={(candidates.data?.perfumes ?? []).map((perfume) => ({
          perfumeId: perfume.perfumeId,
          name: perfume.nameKo ?? perfume.name,
          brand: perfume.brandName,
          thumbnailUrl: perfume.imageUrl,
          alreadyInShelf: inShelf.has(perfume.perfumeId),
        }))}
        isPending={candidates.isFetching}
        onSearch={setRegisterKeyword}
        onSubmit={(input) => {
          setRegisterOpen(false)
          actions.register.mutate(input, {
            onSuccess: () => showToast('진열대에 등록했습니다'),
            /*
              담기는 됐는데 적합도 · 메모만 실패할 수 있습니다(요청이 셋으로
              갈립니다). 그때는 무엇이 빠졌는지 말해 줍니다 — "등록 실패" 라고만
              하면 이미 진열대에 선 향수를 보고 혼란스럽습니다.
            */
            onError: (error) =>
              showToast(
                error instanceof ShelfRegisterPartialError
                  ? `진열대에 등록했지만 ${error.missing.join(' · ')}은(는) 저장하지 못했습니다`
                  : '진열대에 등록하지 못했습니다',
              ),
          })
        }}
      />
      {/*
        ⚠️ **만들 때 향수를 최소 하나 골라야 합니다.** 서버가 `shelfItemIds` 를
        `@NotEmpty` 로 요구합니다 — 와이어프레임 A19 의 "향수 없이도 생성 가능" 과
        어긋나는 자리라, BE 가 제약을 풀면 고르는 목록을 선택으로 되돌립니다.
      */}
      <CollectionFormModal
        open={createCollectionOpen}
        onClose={() => setCreateCollectionOpen(false)}
        candidates={shelf.data ?? []}
        onSubmit={(input, shelfItemIds) => {
          setCreateCollectionOpen(false)
          createCollectionMutation.mutate({ input, shelfItemIds })
        }}
      />
      {/*
        변경하기 (C02). 분류만 고치던 모달이었는데 카드에서 고칠 수 있는 값이
        분류 · 적합도 · 메모 셋이라 한 자리에 모았습니다.
      */}
      <ShelfEditModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        item={panelItem}
        ready={detailReady}
        onSave={(next) => {
          if (selectedId === undefined || panelItem === null) return
          setEditOpen(false)
          actions.edit.mutate(
            { shelfItemId: selectedId, before: panelItem, next },
            {
              onSuccess: () => showToast('변경했습니다'),
              onError: (error) =>
                showToast(
                  error instanceof ShelfEditPartialError
                    ? `${error.missing.join(' · ')}은(는) 바꾸지 못했습니다`
                    : '변경하지 못했습니다',
                ),
            },
          )
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
          if (selectedId === undefined) return
          setRemoveOpen(false)
          actions.remove.mutate(
            { shelfItemId: selectedId },
            {
              onSuccess: () => showToast('진열대에서 뺐습니다'),
              onError: () => showToast('진열대에서 빼지 못했습니다'),
            },
          )
        }}
      />
      <LoginRequiredDialog
        open={loginOpen}
        onClose={() => setLoginOpen(false)}
        redirectTo={ROUTES.MY_SHELF}
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
    <div aria-hidden className="shelf-paper shelf-grain fixed inset-0 -z-10">
      {/*
        수면 물결이 모래에 드리우는 빛 — 잠수해서 들어온 이 화면이 "얕은 물에 비치는 모래" 로
        읽히게 하는 겹입니다. 종이 위 · 결 아래 · 내용 뒤(-z-10)이고, 움직이는 것은 transform
        하나뿐입니다. 값과 까닭은 shelf-display.css 의 .shelf-caustic 에 있습니다.
      */}
      <i className="shelf-caustic" />
    </div>
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
