# UI 상태·인터랙션 명세

- 기준: 2026-09-09 / `develop`
- 색·활자 토큰의 실물: `src/styles/index.css` 의 `@theme`
- 팔레트 근거와 대비 수치: `docs/향해-토큰-명세.md`

> **이 문서는 "공통 규칙 + 예외" 로 되어 있습니다.**
> 2장의 공통 규칙이 모든 컴포넌트에 적용되고, 5장에는 **공통과 다른 것만** 적혀 있습니다.
> 새 컴포넌트를 만들 때는 2장을 그대로 따르고, 벗어나야 하는 것만 5장에 추가하세요.

---

## 1. 스케일

### 1.1 활자

| 토큰 | 크기 | 행간 | 서체 · 굵기 | 쓰는 곳 |
| --- | --- | --- | --- | --- |
| `text-display` | 28px | 1.2 | Serif 600 | 향수명 · 페이지 대표 제목 |
| `text-title` | 20px | 1.3 | Serif 600 | 섹션 제목 |
| `text-heading` | 16px | 1.4 | Serif 600 | 카드 제목 · 소제목 |
| `text-body` | 13px | 1.7 | Sans 400 | 본문 · 설명 · 버튼 · 입력창 |
| `text-caption` | 12px | 1.5 | Sans 400 | 라벨 · 메타 · 배지 |

**5단계로 끝냅니다.** 단계를 늘리면 "이건 어느 쪽이지" 하는 순간이 생기고, 그때부터
임의값이 다시 늘어납니다. 이전에는 임의값(`text-[10.5px]` 91곳 등) 119개가
스케일 클래스 104개보다 많았습니다.

- **`text-[..px]` 임의값 금지.** 위 다섯 개로 안 되면 스케일을 고치는 게 맞습니다
- **`body` 와 `caption` 은 1px 차이라 크기로 위계를 만들지 않습니다.**
  위계는 색이 만듭니다 — 본문 `text-ink`(12.36:1), 보조 `text-ink-muted`(4.51:1)
- 12px 아래로 내려가지 않습니다. 한글은 자소가 많아 11px 이하에서 급격히 읽기 힘들어집니다

### 1.2 굵기

| 값 | 쓰는 곳 |
| --- | --- |
| `font-normal` (400) | 본문 · 설명 — 기본값 |
| `font-medium` (500) | 버튼 · 라벨 · 선택된 항목 |
| `font-bold` (700) | 제목만 |

이전에는 `font-bold` 41곳 · `semibold` 4곳 · `medium` 4곳으로 **강조 수단이 bold 하나**였습니다.
지금 bold 로 되어 있는 것 대부분은 `medium` 이면 충분합니다.

### 1.3 간격

**4 · 8 · 12 · 16 · 24 · 32** 만 씁니다 (Tailwind `1 · 2 · 3 · 4 · 6 · 8`).

- **0.5 단위 전면 금지** — `gap-1.5` · `py-2.5` · `space-y-3.5` 등. 이전 76곳
- 요소 안(`p-*`)과 요소 사이(`gap-*` · `space-y-*`) 모두 같은 스케일

| 값 | 쓰는 곳 |
| --- | --- |
| 4 | 붙어 있는 것 — 라벨과 값, 배지 사이 |
| 8 | 한 덩어리 안 — 카드 안 제목과 브랜드 |
| 12 | 카드 안쪽 여백 |
| 16 | 카드 사이, 폼 항목 사이 |
| 24 | 구역 사이 |
| 32 | 큰 구역 사이 |

### 1.4 모서리

| 토큰 | 값 | 쓰는 곳 |
| --- | --- | --- |
| `rounded-card` | 6px | 카드 · 모달 · 입력창 · 버튼 |
| `rounded-full` | — | 아바타 · 배지 · 지도 포인트 |

그 외 값은 쓰지 않습니다. 컨셉아트의 카드가 거의 각져 있고, 미술관·아카이브 인상이
여기서 나옵니다.

### 1.5 그림자

**떠 있는 높이 = 그 요소가 얼마나 위에 있는가** 로 묶습니다.

| 토큰 | 값 | 쓰는 곳 |
| --- | --- | --- |
| `shadow-raised` | `0 6px 18px rgb(47 47 50 / .09)` | 카드 호버 |
| `shadow-overlay` | `0 10px 26px rgb(47 47 50 / .14)` | 드롭다운 · 팝오버 · 토스트 |
| `shadow-modal` | `0 24px 60px rgb(47 47 50 / .22)` | 모달 |

기본 상태의 카드에는 그림자를 걸지 않습니다. 테두리(`border-line`)로 충분하고,
그림자까지 있으면 목록 전체가 들떠 보입니다.

### 1.6 모션

| 토큰 | 값 | 거는 것 |
| --- | --- | --- |
| 빠름 | `duration-120 ease-out` | 색 · 테두리 · 글자색 |
| 기본 | `duration-200 ease-out` | 위치 · 크기 · 그림자 |

이전에는 `transition-colors` 12곳 · `transition-shadow` 5곳인데 **duration 과 easing 을
지정한 곳이 한 군데도 없었습니다**(전부 Tailwind 기본 150ms).

- `transition-all` 금지. 바꾸는 속성만 지정합니다
- **`prefers-reduced-motion: reduce` 에서는 둘 다 0** 으로 끕니다. 전역으로 걸려 있습니다

### 1.7 층위 (z-index)

| 층 | 값 | 비고 |
| --- | --- | --- |
| 기본 콘텐츠 | `auto` | — |
| 고정 헤더 | `z-10` | 스크롤해도 남는 것 |
| 드롭다운 · 팝오버 | `z-20` | 헤더 메뉴 · 지도 포인트 팝오버 |
| 토스트 | `z-40` | **모달 밖에서만 유효** |
| 모달 | top layer | **z-index 무관** |

> ### ⚠️ 모달은 z-index 로 못 이깁니다
>
> `shared/ui/Modal` 은 네이티브 `<dialog>` 에 `showModal()` 을 씁니다.
> 이건 브라우저의 **top layer** 로 올라가서 z-index 와 무관하게 모든 것 위에 그려집니다.
>
> **모달이 열려 있을 때 띄운 토스트는 모달 아래에 깔려 안 보입니다.**
> 모달 안에서 저장·삭제 피드백이 필요하면 **모달 안에 인라인으로** 그리거나,
> 모달을 닫은 뒤에 토스트를 띄우세요.

---

## 2. 공통 상태 규칙

**아래는 모든 컴포넌트에 같게 적용됩니다.** 5장에는 여기서 벗어나는 것만 적습니다.

| 상태 | 규칙 |
| --- | --- |
| **Default** | `bg-surface-card` · `border-line` 1px · `rounded-card` · `text-ink` |
| **Hover** | 배경 `bg-line-soft` 또는 테두리 `border-accent`. `duration-120` |
| **Focus** | `outline-none focus-visible:ring-2 focus-visible:ring-accent-deep focus-visible:ring-offset-2` |
| **Active** | 별도 표현 없음. Hover 상태를 유지합니다 |
| **Selected** | `bg-ink text-surface` (채움) 또는 `border-accent-deep text-accent-deep` (테두리) |
| **Disabled** | **테두리만 남깁니다** — `bg-transparent border-line text-ink-muted opacity-40 pointer-events-none` |
| **Loading** | 목록은 `Skeleton`, 버튼은 `isLoading`(스피너 + 비활성) |
| **Empty** | `EmptyState` — 제목 + 설명 + (걸러서 0건이면) `초기화` 버튼 |
| **Error** | 인라인 문구는 `text-danger text-caption`, 화면 전체는 `EmptyState` + `다시 시도` |

### 왜 이렇게 정했는가

**Focus 는 `accent` 가 아니라 `accent-deep`** 입니다. `accent`(bronze)는 ivory 위 2.90:1 이라
포커스 표시 기준 3:1 에 못 미칩니다. `accent-deep` 은 4.54:1 입니다.

**Disabled 는 테두리만 남기기로 확정**되었습니다(와이어프레임 A32, S15P21E203-136).
채움을 없애면 "누를 수 없다"가 형태로 드러납니다.

**Active 를 따로 두지 않는 이유** — 마우스에서는 눌린 순간이 너무 짧아 보이지 않고,
터치에서는 Hover 가 곧 Active 입니다. 상태를 하나 줄이면 지켜야 할 것도 줄어듭니다.

**색만으로 뜻을 구분하지 않습니다.** `Badge` 의 `success`·`danger` 처럼 색이 뜻을 담을 때는
라벨 글자를 함께 답니다. 색각 이상 사용자와 흑백 인쇄에서 뜻이 사라집니다.

---

## 3. 화면 폭 — 데스크톱 전용입니다

**모바일 대응은 하지 않습니다.** 와이어프레임이 1920w 데스크톱만 있고,
서비스도 데스크톱에서 쓰는 것을 전제로 합니다. 결정된 사항이므로 "나중에" 도 없습니다.

| 항목 | 값 |
| --- | --- |
| 기준 화면 | 1920 x 1080 — 가장 넓은 규격이고, 여기서 줄어드는 방향으로 맞춥니다 |
| 본문 폭 | `full` 1800(틀 1920 − 여백) · `wide` 1440 · `text` 800 — 라우트 `handle.width` 로 정합니다 |
| 좌우 여백 | `--gutter` 60 (1536~) · 50 (1280~) · 40 (1024~) · 30 (768~) · 20 |
| 치수 | 폭 · 높이 · 간격은 끝자리 0 또는 5. 1~3px 선 굵기와 글자 크기는 예외 |

### 그럼 기존 `sm:` · `lg:` 는 왜 두는가

목록 그리드에 이미 `grid-cols-2 sm:grid-cols-3 lg:grid-cols-5` 가 들어가 있습니다.
**이건 모바일 대응이 아니라 좁은 창에서 안 무너지게 하는 안전장치입니다.**

wide 1440 + 좌우 여백 120 = 1560px 가 필요한데, 1280 노트북을 150% 배율로 쓰면
뷰포트가 853px 이라 5열이 눌립니다. 그래서 **그대로 둡니다.**

- 기존 반응형 그리드는 **유지**합니다
- **새 브레이크포인트를 추가하지 않습니다.** 모바일 레이아웃을 새로 짜지 않습니다
- 폭이 좁아 깨지는 곳이 보이면 브레이크포인트를 늘리지 말고 **콘텐츠를 줄이세요**

---

## 4. 접근성

- **포커스 링을 지우지 않습니다.** `outline-none` 을 쓸 때는 반드시 `focus-visible:ring-*` 를 함께 답니다
- 아이콘만 있는 버튼에는 `aria-label` 을 답니다
- 토글은 `aria-pressed`, 드롭다운은 `aria-expanded` · `aria-haspopup` 을 답니다
- **화면 낭독기가 읽는 문구도 뜻이 맞아야 합니다.** `SegmentedFilter` 의 `label` 은
  화면에 안 보이지만 낭독기가 읽습니다 — 뜻이 틀리면 그대로 잘못 전달됩니다
- 테스트는 `getByRole('button', { name: '저장' })` 처럼 접근성 기준으로 찾습니다.
  클래스명·내부 상태를 검사하지 않습니다

---

## 5. 컴포넌트별 예외

**여기 없는 것은 2장 공통 규칙을 그대로 따릅니다.**

| 컴포넌트 | 공통과 다른 것 |
| --- | --- |
| `PerfumeCard` · `TileCard` | Hover 에 `-translate-y-1` + `shadow-raised`, `duration-200`. Selected 는 `border-accent-deep` 2px |
| `Button` | Selected 없음. `variant` 로 채움을 정합니다 — `primary` 는 `bg-ink text-surface` |
| `Badge` | Hover · Focus 없음(누를 수 없음). `tone` 은 색 이름이 아니라 뜻: `neutral` · `accent` · `success` · `danger` · `outline` |
| `Input` · `Textarea` | Error 는 `border-danger` + 아래에 `text-danger text-caption` 문구. Focus 링이 테두리를 덮습니다 |
| `Checkbox` | Selected(checked)는 `bg-ink`. 크기 14px 고정 |
| `ChipToggle` · `SegmentedFilter` | Selected 는 `bg-ink text-surface` 채움 |
| `Modal` | 배경 `shadow-modal`. **top layer 라 z-index 무관** (1.7 참고) |
| `Toast` | `shadow-overlay` · `z-40`. **모달이 열려 있으면 쓰지 않습니다** |
| `Skeleton` | 목록에서 카드와 **같은 크기**여야 합니다. 다르면 로딩이 끝나는 순간 레이아웃이 튑니다 |
| `Thumbnail` | 이미지가 없으면 `bg-surface-sunken` 자리표시자. 비율은 `--aspect-*` 토큰 |

---

## 6. 아직 안 정한 것

- **향 지도(`map`) 관련 전부** — 재디자인 대기 중입니다. 시안이 나오면 여기에 추가합니다
- **다크 모드** — 서비스가 종이 바탕 하나로 갑니다. 필요해지면 팔레트부터 다시 봐야 합니다
  (`charcoal` 바탕에서는 `shimmer`·`stonegray` 가 본문급으로 살아납니다 — `docs/향해-토큰-명세.md` 3장)
- **무한 스크롤의 로딩 표현** — 백엔드 페이지네이션은 준비돼 있고 화면만 남았습니다
