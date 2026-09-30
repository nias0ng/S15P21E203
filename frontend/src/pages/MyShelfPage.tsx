import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'

import {
  collectionKeys,
  CollectionFormModal,
  CollectionStrip,
  createCollection,
  myCollectionsQuery,
  type CollectionInput,
} from '@/features/collection'
import {
  perfumeDetailQuery,
  perfumeListQuery,
  perfumeNotesQuery,
} from '@/features/perfume'
import {
  accordLabel,
  personalRecommendationQuery,
  RecommendLetter,
  type LetterFacts,
} from '@/features/recommend'
import {
  ShelfDeck,
  ShelfDetailPanel,
  ShelfFooterStrip,
  ShelfPager,
  ShelfPaper,
  ShelfRegisterModal,
  ShelfToolbar,
  ShelfWall,
  shelfItemDetailQuery,
  shelfItemsQuery,
  ShelfEditModal,
  ShelfEditPartialError,
  ShelfRegisterPartialError,
  shelfPartNames,
  useShelfActions,
  useShelfArrangement,
  useShelfBrowser,
  type ShelfItemDetail,
  type ShelfWallHandle,
} from '@/features/shelf'
import { apiErrorMessage } from '@/shared/api/http'
import { ROUTES } from '@/shared/config/routes'
import { useDiveReady } from '@/shared/hooks/useDiveReady'
import { useToast } from '@/shared/hooks/useToast'
import { localizedName } from '@/shared/i18n/locale'
import { READY_GRACE_MS } from '@/shared/lib/diveTrack'
import { useAuthStore, useIsLoggedIn } from '@/shared/store/authStore'
import { useLocale } from '@/shared/store/localeStore'
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

/**
 * 컬렉션 무대로 **바로 들어오는 문** (2026-09-21 — 메인 3D 의 선실 알림 판).
 *
 * 컬렉션 목록은 제 주소가 없습니다(진열대에 병합된 하단 무대 = 아래 `stage` 상태).
 * 밖에서 초깃값을 넣을 구멍이 없어서 이 쿼리 하나를 냅니다 — 값이 없거나 모르는
 * 값이면 평소대로 진열대입니다.
 *
 * ⚠️ 링크를 만드는 쪽은 `shared/config/routes` 의 `toMyShelfCollection()` 입니다.
 * 이름과 값이 **한 벌**이라 한쪽만 고치면 조용히 진열대가 열립니다.
 * ⚠️ 첫 렌더에서 **한 번만** 봅니다(`useState` 초깃값). 매 렌더 읽어 `stage` 를
 * 덮으면 하단 띠의 단추로 무대를 바꿀 수가 없습니다 — 주소는 그대로니까요.
 */
const SHELF_STAGE_PARAM = 'stage'
const SHELF_STAGE_COLLECTION = 'collection'

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
  const { t } = useTranslation('shelf')
  const { t: tc } = useTranslation('collection')
  const locale = useLocale()
  const shelf = useQuery(shelfItemsQuery())
  const collections = useQuery(myCollectionsQuery())
  /*
   * 메인에서 잠수로 들어왔으면 커튼이 짙은 남색으로 덮은 채 이 신호를 기다립니다
   * (안 알려도 1.5초 상한에 걷힙니다 — shared/ui/DiveCurtain).
   *
   * 기준은 **목록**입니다. 이게 오면 벽과 벽감이 섭니다 — 아래 `shelf.isPending` 이
   * 스피너로 갈리는 바로 그 조건입니다.
   *
   * ⭐ 다만 곧바로 알리지 않고 `READY_GRACE_MS` 를 둡니다. 목록이 칠해진 것은 **벽이 섰다**는
   * 뜻일 뿐이라, 그 자리에서 걷으면 병 사진이 걷힌 뒤에 한 장씩 떠올랐습니다. 그 사이에
   * 첫 화면 병이 다 서면 `ShelfWall` 이 따로 알려 **그쪽이 먼저 이깁니다** —
   * 즉 `min(첫 화면 병, 목록 + 유예)` 입니다. 사진을 끝까지 기다리지는 않습니다.
   */
  useDiveReady(!shelf.isPending, READY_GRACE_MS)
  const arrangement = useShelfArrangement()
  // 낙관적 갱신과 되돌리기는 도메인 훅이 들고 있습니다. 토스트만 여기서 붙입니다
  const actions = useShelfActions()
  const queryClient = useQueryClient()

  const [searchParams] = useSearchParams()
  const [stage, setStage] = useState<Stage>(() =>
    searchParams.get(SHELF_STAGE_PARAM) === SHELF_STAGE_COLLECTION
      ? 'collection'
      : 'shelf',
  )
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
  /*
   * 벽에 선 분류의 병일 때만 패널에 올립니다 (S15P21E203-431). 빈 분류를 고르면 선택은 그대로
   * 남아 있어서(useShelfBrowser 의 selectFirstOf), 그대로 두면 빈 벽감 옆에 다른 분류의 병이
   * 떠 있습니다.
   */
  const selectedOnWall =
    browser.selected !== null &&
    browser.selected.category === browser.viewCategory
  const panelItem: ShelfItemDetail | null =
    browser.selected === null || !selectedOnWall
      ? null
      : detailReady
        ? selectedDetail.data
        : {
            ...browser.selected,
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

  /*
   * 개인화 추천 편지 (S15P21E203-431). 진열대에 몇 병이 있는지로 가리지 않습니다 — 서버는 진열대가
   * 비어 있어도 취향 테스트만으로 고르고, 거꾸로 테스트를 안 했으면 진열대가 가득해도 고르지
   * 않습니다(그때는 테스트로 이끄는 봉투가 꽂힙니다). 로그인해야 부를 수 있습니다.
   */
  const recommendation = useQuery({
    ...personalRecommendationQuery(),
    enabled: isLoggedIn,
  })
  const recipient = useAuthStore((state) => state.user?.nickname ?? null)

  /*
   * 편지 속 향수의 브랜드 · 영문 이름 · 향 특성. 추천 응답에는 이름 · 사진 · 근거 한 문장뿐이라 향수
   * 상세 · 향조로 채웁니다. 편지가 알려 주는 번호(onShow)로 부르고, 캐시가 향수 상세 화면과 같은 키라
   * 편지에서 "자세히 보기" 로 넘어가면 다시 부르지 않습니다.
   */
  const [letterPerfumeId, setLetterPerfumeId] = useState<number | null>(null)
  const letterDetail = useQuery({
    ...perfumeDetailQuery(letterPerfumeId ?? 0),
    enabled: letterPerfumeId !== null,
  })
  const letterNotes = useQuery({
    ...perfumeNotesQuery(letterPerfumeId ?? 0),
    enabled: letterPerfumeId !== null,
  })
  const letterFacts: LetterFacts | undefined =
    letterPerfumeId !== null && letterDetail.data?.perfumeId === letterPerfumeId
      ? {
          perfumeId: letterPerfumeId,
          brand: letterDetail.data.brand?.name ?? null,
          // 한국어 이름이 있을 때만 영문을 작게 답니다 — 편지의 큰 이름이 이미 영어면 되풀이입니다
          nameEn: letterDetail.data.nameKo ? letterDetail.data.name : null,
          // 두드러진 순서(rank 가 작을수록)로, 3D 향 지도 카드와 같은 표로 한국어로 옮겨 적습니다
          accords: [...(letterNotes.data?.accords ?? [])]
            .sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity))
            .map((accord) => accordLabel(accord.name)),
        }
      : undefined

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
      showToast(tc('toast.created'))
    },
    onError: (error) =>
      showToast(
        // 이름이 겹치면 409 입니다
        apiErrorMessage(error, tc('toast.createFailed')),
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
          title={t('page.loginRequired.title')}
          description={t('page.loginRequired.description')}
          action={
            <LinkButton to={ROUTES.LOGIN} variant="outline" size="sm">
              {t('page.loginRequired.action')}
            </LinkButton>
          }
        />
      )
    }

    return (
      <EmptyState
        title={t('page.loadError.title')}
        description={apiErrorMessage(
          shelf.error,
          t('page.loadError.description'),
        )}
        onRetry={() => void shelf.refetch()}
        retrySize="sm"
      />
    )
  }

  const collectionCount = collections.data?.length ?? 0

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
      {t('page.register')}
    </Button>
  )

  const toolbar = (stacked?: boolean) => (
    <ShelfToolbar
      keyword={browser.keyword}
      onKeywordChange={browser.changeKeyword}
      action={registerButton}
      stacked={stacked}
    />
  )

  const shelfWall = (
    className: string,
    aside?: ReactNode,
    menuHeader?: ReactNode,
  ) => (
    <ShelfWall
      ref={wall}
      sections={browser.sections}
      category={browser.viewCategory}
      selectedId={browser.selected?.shelfItemId ?? null}
      onSelect={browser.select}
      onViewCategoryChange={browser.changeViewCategory}
      // 메뉴판을 누르면 그 분류의 첫 향수를 고릅니다. 벽은 분류가 바뀌면 스스로 흐릅니다
      onPlaqueSelect={browser.selectFirstOf}
      resetKey={browser.keyword}
      empty={(category) =>
        browser.keyword
          ? {
              title: t('page.searchEmpty.title', {
                keyword: browser.keyword.trim(),
              }),
              description: t('page.searchEmpty.description'),
              action: (
                <Button
                  variant="outline"
                  size="sm"
                  className="focus-visible:ring-[var(--shelf-ink)] focus-visible:ring-offset-[var(--paper)]"
                  onClick={() => browser.changeKeyword('')}
                >
                  {t('page.searchEmpty.clear')}
                </Button>
              ),
            }
          : /*
              분류마다 **비어 있는 까닭과 채우는 길**이 달라서 말도 다릅니다 — "아직 담은 향수가
              없습니다" 한 줄을 셋이 같이 쓰던 때는 어느 칸이 왜 비었는지 말하지 않았습니다.
            */
            {
              title: t(`page.empty.${category}.title`),
              description: t(`page.empty.${category}.description`),
              action: registerButton,
            }
      }
      className={className}
      aside={aside}
      menuHeader={menuHeader}
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
      // 목록이 아는 값으로 먼저 채운 동안 — 향조 · 메모 자리를 "없어요" 대신 비워 둡니다
      pending={!detailReady}
      onChangeRating={(rating) => {
        if (selectedId === undefined) return
        /*
          성공 토스트를 띄우지 않습니다 — 원이 차는 것이 이미 답이고, 점수를
          맞춰 보느라 여러 번 누르게 되어 토스트가 연달아 뜹니다.
          실패는 원이 되돌아가는 것만으로는 읽히지 않아 말해 줍니다.
        */
        actions.rating.mutate(
          { shelfItemId: selectedId, rating },
          { onError: () => showToast(t('toast.ratingFailed')) },
        )
      }}
      onEdit={() => setEditOpen(true)}
      onRemove={() => setRemoveOpen(true)}
      placeholder={
        browser.selected !== null && !selectedOnWall
          ? t('page.categoryEmptyPanel')
          : undefined
      }
      className={className}
    />
  )

  /*
    제목 줄은 진열대 무대와 같은 높이 · 같은 가운데에 서고(무대가 바뀔 때 제목이 같은 줄에서 갈립니다),
    개수는 제목 글줄의 기준선에 앉습니다 — 가운데로 맞추면 작은 글자가 제목 위쪽에 떠 보입니다.
  */
  const collectionHeader = (
    <div className="flex min-h-12.5 items-center">
      <div className="flex items-baseline gap-5">
        <h2 className={STAGE_TITLE}>{t('page.collectionTitle')}</h2>
        <span className="shelf-muted text-body tabular-nums">
          {t('page.collectionCount', { count: collectionCount })}
        </span>
      </div>
    </div>
  )

  // 못 받았을 때도 이 자리에서 까닭과 다시 부르는 단추를 세웁니다(CollectionStrip)
  const collectionStrip = (
    <CollectionStrip
      items={collections.data ?? []}
      isPending={collections.isPending}
      isError={collections.isError}
      onRetry={() => void collections.refetch()}
      onCreate={() => setCreateCollectionOpen(true)}
      // 한 장 배치의 무대는 높이가 화면에 묶여, 두 줄이 다 들도록 칸 수를 높이로 고릅니다(노트북 창)
      fitRows={arrangement !== 'stacked'}
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
          name: localizedName(locale, perfume.name, perfume.nameKo),
          brand: perfume.brandName,
          thumbnailUrl: perfume.imageUrl,
          alreadyInShelf: inShelf.has(perfume.perfumeId),
        }))}
        isPending={candidates.isFetching}
        onSearch={setRegisterKeyword}
        onSubmit={(input) => {
          setRegisterOpen(false)
          actions.register.mutate(input, {
            onSuccess: () => showToast(t('toast.registered')),
            /*
              담기는 됐는데 적합도 · 메모만 실패할 수 있습니다(요청이 셋으로
              갈립니다). 그때는 무엇이 빠졌는지 말해 줍니다 — "등록 실패" 라고만
              하면 이미 진열대에 선 향수를 보고 혼란스럽습니다.
            */
            onError: (error) =>
              showToast(
                error instanceof ShelfRegisterPartialError
                  ? t('toast.registerPartial', {
                      parts: shelfPartNames(error.missing),
                    })
                  : t('toast.registerFailed'),
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
              onSuccess: () => showToast(t('toast.edited')),
              onError: (error) =>
                showToast(
                  error instanceof ShelfEditPartialError
                    ? t('toast.editPartial', {
                        parts: shelfPartNames(error.missing),
                      })
                    : t('toast.editFailed'),
                ),
            },
          )
        }}
      />

      {/* 되돌릴 수 없는 조작이라 확인을 받습니다 (공통 규칙 C01) */}
      <ConfirmDialog
        open={removeOpen}
        onClose={() => setRemoveOpen(false)}
        title={t('page.removeConfirm.title', {
          name: browser.selected?.name ?? t('page.removeConfirm.fallbackName'),
        })}
        description={t('page.removeConfirm.description')}
        confirmLabel={t('page.removeConfirm.confirm')}
        onConfirm={() => {
          if (selectedId === undefined) return
          setRemoveOpen(false)
          actions.remove.mutate(
            { shelfItemId: selectedId },
            {
              onSuccess: () => showToast(t('toast.removed')),
              onError: () => showToast(t('toast.removeFailed')),
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

  // 시안의 종이 바탕과 질감 — 뷰포트를 통째로 덮습니다(ShelfPaper). 컬렉션 상세도 같은 종이를 깝니다
  const paper = <ShelfPaper />

  /*
    편지 속 향수를 진열대에 담는 단추. 추천은 "아직 없는 향수" 라 **보유 희망**에 담습니다 — 가졌다면
    보유 중에서 고르는 편지가 오지 않습니다(서버가 보유 중만 뺍니다). 이미 담긴 향수(시향 · 희망)면
    담았다고만 적습니다. 진열대 도메인의 일이라 편지(추천 도메인)가 아니라 화면이 만듭니다.
  */
  const saveFromLetter = (perfumeId: number) =>
    inShelf.has(perfumeId) ? (
      <Button variant="outline" size="sm" disabled className="rec-action">
        {t('page.letter.inShelf')}
      </Button>
    ) : (
      <Button
        size="sm"
        className="rec-action focus-visible:ring-[var(--shelf-ink)] focus-visible:ring-offset-[var(--paper)]"
        isLoading={
          actions.register.isPending &&
          actions.register.variables?.perfumeId === perfumeId
        }
        onClick={() =>
          actions.register.mutate(
            { perfumeId, category: 'WISH', rating: null, memo: null },
            {
              onSuccess: () => showToast(t('toast.wishAdded')),
              onError: () => showToast(t('toast.wishFailed')),
            },
          )
        }
      >
        {t('page.letter.addWish')}
      </Button>
    )

  /*
    개인화 추천 편지 — 상세 패널 윗변에 봉투로 꽂혀 있다가 누르면 그 패널 크기로 펼쳐집니다
    (RecommendLetter). 패널과 **같은 자리(위치 기준 상자)** 안에 둬야 펼친 편지가 패널에 꼭 맞습니다.
    추천할 것이 없으면(404 · 503 · 아직 모름) 아무것도 그리지 않습니다 — 빈 봉투는 아무 말도 안 합니다.
    벽에서 다른 병을 고르면(closeKey) 편지를 접어 그 병의 상세를 보입니다.
  */
  const letter = (placement: 'right' | 'left') => (
    <RecommendLetter
      result={recommendation.data}
      isRefreshing={recommendation.isFetching}
      // 새로 받은 결과를 돌려줍니다 — 묻다 실패하면 옛 결과가 남아 있어 undefined 로 알립니다
      onNext={async () => {
        const next = await recommendation.refetch()
        return next.isError ? undefined : next.data
      }}
      onShow={setLetterPerfumeId}
      facts={letterFacts}
      renderSave={saveFromLetter}
      recipient={recipient}
      closeKey={selectedId}
      placement={placement}
    />
  )

  if (arrangement === 'stacked') {
    return (
      <div className="shelf-scope flex flex-col">
        {paper}

        <div className="flex flex-col gap-5">
          <h1 className={STAGE_TITLE}>{t('page.title')}</h1>
          {toolbar()}
        </div>

        {/*
          벽이 좌우 여백으로 스며 나가는 페이드를 본문 폭에서 자르지 않고 여백 바깥에서
          자릅니다(한 장 배치의 ShelfDeck 과 같은 이유). 자르지 않으면 옆으로 긴 벽이
          페이지 가로 스크롤을 만듭니다.

          높이는 화면 폭을 따릅니다 — 페이지가 스크롤되어 남는 세로 공간이라는 기준이
          없습니다. 휴대폰에서 병 셋, 태블릿에서 병 넷 남짓이 한 화면에 섭니다.
          위아래 끝(380 · 560)은 1920 기준이라 `--spacing` 을 곱해 적습니다 — 벽만
          유틸리티 밖에 있으면 옆의 여백 · 카드가 줄어드는 만큼 벽이 혼자 커 보입니다.
        */}
        <div className="-mx-[var(--gutter)] mt-7.5 overflow-x-clip px-[var(--gutter)]">
          {shelfWall(
            'h-[clamp(calc(var(--spacing)*95),72vw,calc(var(--spacing)*140))]',
          )}
        </div>

        <ShelfPager
          index={browser.index}
          total={browser.total}
          onPrev={() => browser.move(-1)}
          onNext={() => browser.move(1)}
          className="mt-2.5 self-end"
        />

        {/* 편지 봉투는 카드 윗변 왼쪽에 꽂힙니다 — 오른쪽 위에는 페이저가 섭니다 */}
        <div className="relative mt-5">
          {detail()}
          {letter('left')}
        </div>

        <section
          aria-label={t('page.collectionTitle')}
          className="mt-15 flex flex-col gap-7.5"
        >
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
      `--header-h` 는 헤더 높이(1920 에서 90)이고 화면을 따라 같이 줄어듭니다 — 90 을
      손으로 적으면 헤더만 줄어들어 1536 에서 페이지에 세로 스크롤이 생깁니다.

      최소 높이는 **상세 카드의 가장 작은 모습이 벽 자리에 드는 높이**입니다 — 카드 위 · 아래 자리
      (제목 줄 · 하단 띠 · 사이, 1920 에서 216)는 --spacing 을 따라 줄고, 카드(0.85 배 · 병 자리 하한 100 →
      443)는 줄지 않아 둘을 따로 더합니다. 1920 에서 661, 1536 · 1280 에서 618 이고, 그보다 낮은 창(노트북
      150% 배율에 창 모드 1280 x 600 등)은 카드가 하단 띠에 겹치는 대신 페이지가 조금 스크롤됩니다.
      NOTE: 상세 카드에 줄을 더하면 445 도 같이 올립니다 — 모자라면 낮은 창에서 MEMO 가 하단 띠에 걸립니다.
    */
    <div className="shelf-scope -mt-15 -mb-15 flex h-[calc(100dvh_-_var(--header-h))] min-h-[calc(var(--spacing)*54+445px)] flex-col">
      {paper}

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
            {/*
              제목만 있는 줄입니다. 검색창과 등록 단추는 벽의 분류 메뉴 위로 내려갔습니다 —
              머리줄이 화면 폭을 가로지르면 그 아래 진열장이 그만큼 낮아집니다.
            */}
            <div className="flex min-h-12.5 items-center">
              <h1 className="shrink-0 font-serif text-[36px] leading-[1.2] font-semibold">
                {t('page.title')}
              </h1>
            </div>

            {shelfWall(
              'mt-7.5 flex-1',
              /*
                높이는 벽감 + 이름표 자리까지. 작은 화면에서는 벽감을 따라 통째로 줄어듭니다(ShelfWall).
                편지는 패널과 같은 자리 안에 둡니다 — 봉투는 패널 윗변 오른쪽에 꽂히고, 펼치면 패널에 꼭 맞습니다.
              */
              <>
                {detail('flex-1')}
                {letter('right')}
              </>,
              // 좁은 기둥 안이라 검색창과 단추를 세로로 세웁니다
              toolbar(true),
            )}
          </div>,

          /*
            내 컬렉션 — 시안에는 없지만 A13 의 아래 절반이라 지우지 않고 둡니다.
            진열대 무대와 같은 자리에 같은 크기의 제목을 둬서, 바뀔 때 제목이 같은
            줄에서 갈려 올라옵니다. 컬렉션이 많아 넘치면 이 무대 안에서만 스크롤합니다.

            스크롤 칸은 사방으로 5 넓혀 두고 안쪽을 같은 만큼 띄웁니다 — 진열함의 포커스 링이
            진열함 밖 5 에 돌아서, 칸 끝에 붙으면 스크롤 칸에 잘립니다. 스크롤 막대는 가늘게
            종이 선 색으로 둡니다(기본 회색 막대가 종이 위에 떠 보입니다).
            아래 여백은 10 입니다 — 넓히면 노트북 창(1536 x 730)에서 두 줄이 다 보이는데도 여백만큼
            넘쳐 스크롤 막대가 뜹니다. 마지막 줄 아래는 명판이라 포커스 링 자리가 따로 필요 없습니다.
          */
          <div
            key="collection"
            className="flex h-full flex-col px-[var(--gutter)] pt-10"
          >
            {collectionHeader}

            <div className="-mx-1.25 mt-6.25 min-h-0 flex-1 [scrollbar-width:thin] [scrollbar-color:var(--hairline)_transparent] overflow-y-auto px-1.25 pt-1.25 pb-2.5">
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
