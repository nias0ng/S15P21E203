# CLAUDE.md

향수 추천 서비스 "향해(hyanghae)" 모노레포(`backend/`, `frontend/`, `ai/`)의 프론트엔드입니다.
환경 구성과 배경 설명은 `docs/프론트엔드-초기-설정-가이드.md`, 작업 중 찾아보는 규약 요약은 `README.md`에 있습니다.

React 19 · TypeScript · Vite · TanStack Query v5 · Zustand · Tailwind v4 · react-router v8.
FE 작업자는 3명입니다.

## 작업 범위: `frontend/` 밖은 건드리지 않습니다

**FE 팀의 작업 범위는 `frontend/` 폴더 안으로 한정됩니다.** 저장소 루트, `backend/`, `ai/`,
`docs/`, `Jenkinsfile`, `compose.*.yaml`, `.gitlab/`, `TIL/` 은 다른 파트 담당이라 수정하지 않습니다.

`frontend/` 밖이 바뀌어야 하는 일이 생기면 **직접 고치지 말고 해당 파트에 요청합니다.**
예를 들어 Jenkins 파이프라인에 프론트엔드 검증 스테이지를 넣는 작업은 `Jenkinsfile` 수정이
필요하므로 infra 담당자의 작업입니다.

`frontend/` 밖을 수정해야 한다고 판단되면, 파일을 고치기 전에 먼저 사용자에게 알리고
어느 파트에 요청할 일인지 확인합니다.

## 협업 규약 (Git · Jira)

근거 문서는 `../docs/Git_컨벤션_규칙.pdf`, `../docs/git_branch_보호_조건.pdf`,
`../docs/Jira_이슈_관리_규칙.pdf`, `../docs/Jira와_GitLab_연동.pdf` 입니다(읽기만 합니다).
아래 규칙은 **사용자가 그 작업에 대해 명시적으로 예외를 허용하지 않는 한 무조건 지킵니다.**
"빠르니까", "작은 변경이니까" 같은 이유로 우회하지 않습니다.

Jira 프로젝트 키는 `S15P21E203`이고 브랜치·MR에 **전체 이슈 키**를 씁니다.

```
브랜치   {작업유형}/fe/S15P21E203-{이슈번호}-{기능명}
        예: chore/fe/S15P21E203-116-frontend-ui-foundation
커밋     {타입}: S15P21E203-{이슈번호} {작업 내용}     (문장 끝 마침표 없음)
        예: feat: S15P21E203-42 자연어 기반 향수 추천 화면 구현
MR      [S15P21E203-42][feat] 자연어 기반 향수 추천 기능 구현
```

- 커밋 타입: `feat` `fix` `refactor` `design` `docs` `test` `chore` `remove`
- Jira Story 제목: `[FE][작업종류] 작업 내용` (작업종류는 `Feature` `Fix` `Refactor` `Test` `Docs` `Chore` `Design`)
- 모든 작업 브랜치는 **최신 `develop`에서** 생성합니다. 1 Jira 이슈 = 1 브랜치 = 1 MR.
- `master`·`develop`에 **직접 push 하지 않습니다.** 둘 다 Protected(push No one, force push 불가,
  파이프라인 성공 후 병합 필수, MR 승인 1명 이상)입니다.
- 관련 없는 작업을 한 브랜치에 함께 담지 않습니다. 1 커밋 = 1개의 의미 있는 작업.
- `rebase` 대신 `merge`로 통일합니다. 작업 시작 전과 MR 생성 전에 최신 `develop`을 반영합니다.
- **커밋은 사용자가 요청할 때만** 만듭니다.
- MR 본문은 `../.gitlab/merge_request_templates/Default.md` 템플릿을 채웁니다(읽기만 합니다).
  MR 올리기 전 `npm run verify` 통과가 조건입니다.

## 프로토타입 브랜치 (`design/fe/S15P21E203-prototype`)

진열대·컬렉션·커뮤니티 재설계 시안을 프론트 팀원들이 함께 다듬는 **공유 기준선**입니다.
`develop` 에 병합할 상태가 아니라 따로 둡니다. 이 브랜치와 그 하위 브랜치에서 작업하는
동안만 위 협업 규약의 네 항목이 아래로 대체되고, **나머지는 전부 그대로입니다**
(커밋 타입, `merge` 통일, `npm run verify` 통과, 커밋은 사용자가 요청할 때만).

| 항목 | 평소 | 프로토타입 작업 중 |
| --- | --- | --- |
| 분기 기준 | 최신 `develop` | `origin/design/fe/S15P21E203-prototype` |
| MR 타겟 | `develop` | `design/fe/S15P21E203-prototype` |
| 브랜치명 | `{타입}/fe/S15P21E203-{번호}-{기능명}` | `design/fe/S15P21E203-prototype-{작업단위}` |
| 커밋 | `{타입}: S15P21E203-{번호} {내용}` | `{타입}: {내용}` — 대응 Jira 이슈가 없어 키를 뺍니다 |

작업 단위는 **사람 이름이 아니라 무엇을 고치는지**로 짓습니다(`-shelf-spacing`, `-community-cards`).
사람 이름으로 파면 한 사람의 여러 작업이 한 브랜치에 쌓여 MR 이 리뷰 불가능해집니다.

### 가지 치기

```bash
git fetch origin && git switch -c design/fe/S15P21E203-prototype-shelf-spacing origin/design/fe/S15P21E203-prototype
```

### push 와 MR 생성 — 첫 push 에 같이 합니다

```bash
npm run verify   # 먼저 통과시킵니다
git push -u origin design/fe/S15P21E203-prototype-shelf-spacing -o merge_request.create -o merge_request.target=design/fe/S15P21E203-prototype -o "merge_request.title=[S15P21E203][design] 진열대 벽감 여백 조정" -o merge_request.remove_source_branch
```

- **`merge_request.target` 을 빠뜨리면 타겟이 `develop` 으로 잡힙니다.** 시안 코드가 `develop` MR 로
  올라갑니다. 매번 명시하고, MR 페이지에서 타겟을 눈으로 한 번 더 확인합니다.
- push option 은 **ref 업데이트가 있을 때만** 서버로 갑니다. 이미 push 한 브랜치에 옵션만 다시
  붙여 push 하면 `Everything up-to-date` 로 끝나고 MR 이 안 생깁니다. 그래서 첫 push 에 붙입니다.
- push option 값에는 개행을 넣을 수 없습니다. MR 본문
  (`../.gitlab/merge_request_templates/Default.md`)은 웹 Edit → Description 에 붙여넣습니다.

### 기준선 따라잡기

남의 MR 이 병합되면 기준선이 앞서갑니다. 규약대로 **`merge` 를 씁니다.**

```bash
git fetch origin && git merge origin/design/fe/S15P21E203-prototype
```

`rebase` 는 히스토리를 다시 써서 force push 가 필요해지고, force push 는 아래 사고를 냅니다.

### 히스토리 정리는 첫 push 전에만

아직 원격에 없는 브랜치는 `rebase -i` 로 커밋 메시지를 고쳐도 안전합니다. **한 번 push 한 뒤에는
손대지 않습니다** — 고치려면 force push 가 필요하고 그게 아래 사고를 냅니다. 그래서 순서가
중요합니다: 커밋 정리 → 기준선 merge → `npm run verify` → 첫 push(+MR). push 한 뒤에 오타를
발견했으면 그냥 두고, 고칠 내용은 MR 본문에 적습니다.

### 하지 말 것

- **`--force` / `--force-with-lease` push** — MR 이 열려 있으면 **MR 이 Closed 됩니다**
  (MR !78 에서 실제로 발생). 되돌릴 커밋이 있으면 히스토리를 고치지 말고 `git revert` 로 새 커밋을
  쌓습니다. MR 이 없어도 공유 브랜치라 남의 커밋이 날아갑니다.
- **MR 타겟을 `develop` 으로 두기** — 위 옵션을 빠뜨리면 이렇게 됩니다.
- **`design/fe/S15P21E203-prototype` 자체를 `develop` 에 병합** — 커밋에 Jira 키가 없고 시안 과정이
  다 남아 있어 컨벤션에 맞지 않습니다.

### `develop` 으로 넘길 때

프로토타입 브랜치로 MR 을 열지 않습니다. Jira 이슈를 먼저 만들어 번호를 받고, `develop` 에서 새
브랜치를 파서 **정리된 파일 상태만** 옮겨 담습니다.

```bash
git switch -c design/fe/S15P21E203-{번호}-shelf-redesign develop
git checkout design/fe/S15P21E203-prototype -- src/features/shelf
git commit -m "design: S15P21E203-{번호} 진열대를 컬렉션 진열장 시안으로 재구성"
```

`git checkout {브랜치} -- {경로}` 는 파일 상태만 가져오고 커밋 히스토리는 따라오지 않습니다.
화면 단위로 반복해 의미 있는 커밋만 새로 쌓습니다.

### 향수병 사진은 저장소에 없습니다

`src/assets/bottles/` 는 브랜드 공식 제품 사진이라 `.gitignore` 에 있습니다. 브랜치를 받아도 병
실루엣만 보이는 게 정상입니다. 사진은 저장소 밖(드라이브·노션)에서 받아 그 경로에 풉니다.

## 명령어

```bash
npm run dev          # 개발 서버 (5173, /api 는 localhost:8080 으로 프록시)
npm run dev:mock     # 백엔드 없이 목데이터로 개발 서버 (아래 "목데이터 모드")
npm run test         # 테스트 1회 실행
npm run test:watch   # 테스트 감시 모드
npm run verify       # format:check + lint + typecheck + test + build — MR 전에 반드시 통과
```

`npm run verify`가 MR 통과 기준입니다. lint 는 `--max-warnings=0`이라 경고도 실패입니다.

### 목데이터 모드 (`npm run dev:mock`)

백엔드(Docker) 없이 화면을 만들 때 씁니다. 개발 서버가 `/api/v1` 요청 가운데 **로그인 · 진열대 ·
컬렉션 · 향해 일지 · 향수 검색**만 대신 답하고(`mock/api.ts`), 나머지는 평소처럼 백엔드 프록시로
넘깁니다. 앱 코드는 목데이터를 모릅니다 — 화면에서 목데이터인지 가르지 않습니다.

- 로그인: 이메일 · 비밀번호는 아무 값이나 됩니다(폼 검사만 통과하면) → 향해테스터
- 처음 상태: 진열대 30병(보유 중 · 시향해 봄 · 보유 희망 10병씩) · 컬렉션 6개 · 향해 일지 11줄
  (`mock/seed.ts`). 바꾼 값은 메모리에만 있어 개발 서버를 다시 켜면 처음으로 돌아갑니다.
- 병 사진: `src/assets/bottles/`(로컬 전용)가 있으면 그 사진을, 없으면 서버의 종이 질감 사진을 씁니다.
  서버 사진은 투명 여백을 자르지 않아 병이 작게 섭니다.
- 응답 모양은 백엔드 DTO 를 옮긴 것입니다. 백엔드가 바뀌면 `mock/api.ts` 도 맞춥니다.

## 코드를 어디에 둘지 — 판단 순서

새 코드를 쓸 때 위에서부터 순서대로 묻고, 처음 "예"가 나오는 곳에 둡니다.
**애매하면 항상 도메인 안(`features/`)에 둡니다.** 나중에 `shared/`로 올리는 건 쉽지만,
`shared/`에 잘못 올라간 도메인 코드를 되돌리는 건 이미 3명이 그걸 import 한 뒤입니다.

| 질문 | 예 → 위치 |
| --- | --- |
| 라우트 하나에 1:1로 대응하는 화면인가? | `pages/XxxPage.tsx` (default export) |
| 서버 데이터를 주고받는가? | `features/<도메인>/api.ts` + `queries.ts` |
| 특정 도메인의 화면 조각인가? | `features/<도메인>/components/` |
| 특정 도메인의 상태·로직을 담은 훅인가? | `features/<도메인>/hooks/` |
| **두 개 이상의 도메인**에서 이미 쓰이는 UI인가? | `shared/ui/` |
| **두 개 이상의 도메인**에서 이미 쓰이는 훅인가? | `shared/hooks/` |
| React 를 모르는 순수 함수인가(포맷·계산·변환)? | `shared/lib/` |
| 로그인 여부처럼 앱 전역 클라이언트 상태인가? | `shared/store/` |
| 그 외 전부 | `features/<도메인>/` |

### "두 개 이상"은 실제로 두 번째가 생겼을 때입니다

예상해서 미리 `shared/`에 올리지 않습니다. 처음에는 `features/perfume/components/PerfumeCard.tsx`로
만들고, 컬렉션 화면에서 같은 카드가 필요해진 그 시점에 `shared/ui/`로 올립니다.
**단, 올릴 때는 도메인 타입 의존을 반드시 끊습니다.**

```tsx
// X - shared 인데 perfume 타입을 알고 있음. ESLint 가 에러로 막습니다.
export function PerfumeCard({ perfume }: { perfume: PerfumeSummary }) {}

// O - 도메인을 모르는 껍데기. 데이터는 호출하는 쪽이 꽂아줍니다.
export function Card({ children, interactive }: CardProps) {}
```

### 훅 vs util 구분

React 훅(`useState`, `useQuery`, `useEffect`…)을 하나라도 쓰면 `hooks/`에 `useXxx.ts`로,
안 쓰면 `lib/`에 순수 함수로 둡니다. 이 경계를 지키면 util 은 테스트할 때 렌더링이 필요 없습니다.

```
shared/lib/formatDate.ts     날짜 문자열 변환      → 훅 없음
features/map/hooks/useMapViewport.ts   지도 좌표 상태  → useState 사용
```

## 레이어 의존 방향 (ESLint가 강제합니다)

```
app  →  pages  →  features  →  shared
```

역방향과 도메인 간 교차는 `import-x/no-restricted-paths`로 **lint 에러**입니다.

- `shared/`는 `features/`·`pages/`·`app/`을 import 할 수 없습니다.
- `features/`는 `pages/`·`app/`을 import 할 수 없습니다.
- **`features/a`는 `features/b`를 import 할 수 없습니다.**
  두 도메인이 함께 필요하면 공통 부분을 `shared/`로 올리거나 `pages/`에서 조합합니다.

새 도메인 폴더를 만들면 `eslint.config.js`의 `FEATURE_DOMAINS` 배열에도 추가해야 검사가 걸립니다.

### 도메인은 `index.ts`로만 드나듭니다

```ts
import { perfumeDetailQuery } from '@/features/perfume'          // O
import { perfumeDetailQuery } from '@/features/perfume/queries'   // X
```

내부 파일을 쪼개거나 옮겨도 화면 코드가 깨지지 않게 하려는 것입니다.
새 것을 밖에서 쓰려면 `features/<도메인>/index.ts`에 export 를 추가합니다.

`shared/ui/`는 반대로 **직접 import** 합니다(`@/shared/ui/Button`). 배럴을 두지 않는 이유는
버튼 하나 고칠 때 공용 UI 전체가 다시 번들되면서 HMR 이 느려지기 때문입니다.

## 공용 UI 인벤토리

새로 만들기 전에 여기 있는지 먼저 봅니다. 있으면 그걸 씁니다.

| 컴포넌트 | 용도 |
| --- | --- |
| `shared/ui/Button` | `variant` primary·secondary·outline·ghost·danger / `size` sm·md·lg·icon / `isLoading` |
| `shared/ui/Input` | 라벨·에러·hint·접근성 속성 포함. 라벨은 필수 prop |
| `shared/ui/Textarea` | 여러 줄 입력. `Input` 과 같은 API(라벨 필수 · 에러 · hint · 접근성 속성) |
| `shared/ui/Thumbnail` | 이미지 슬롯. 이미지가 없으면 자리표시자 상자. 크기는 `className` 으로. 아바타(`rounded-full`)도 이걸 씁니다 |
| `shared/ui/Checkbox` | 사각 체크박스(14px). 라벨은 호출하는 쪽에서 `<label>` 로 감싸세요 |
| `shared/ui/SearchField` | 검색 입력 + 버튼. 헤더에 검색창이 없어 목록 화면마다 반복됩니다 |
| `shared/ui/Badge` | 향 계열·상태 같은 짧은 라벨. `tone` neutral·accent·success·danger·outline |
| `shared/ui/PerfumeCard` | 향수 카드. 도메인 타입을 받지 않고 `name`·`brand`·`thumbnailUrl` 낱개로 받습니다 |
| `shared/ui/ChipToggle` | 칩 여러 개 중 고르기 (A11 진열대 분류 · 계절 등록, A15) |
| `shared/ui/StarRating` | 별점. 라디오 그룹이라 키보드 화살표로 움직입니다 |
| `shared/ui/Modal` | 네이티브 `<dialog>` 기반. 포커스 가두기·Esc·배경 스크롤 잠금 자동 |
| `shared/ui/ConfirmDialog` | 삭제 확인 모달 (C01). 7곳 공용. `destructive` 로 위험 표현 |
| `shared/ui/LoginRequiredDialog` | 로그인 유도 모달 (C01). 비로그인 저장·작성 시도 시 |
| `shared/ui/Toast` | 저장·삭제 피드백 (C03). 상태는 `shared/hooks/useToast` 를 쓰세요 |
| `shared/ui/Skeleton` | 로딩 중 자리 잡기. 목록에는 스피너보다 이걸 씁니다 |
| `shared/ui/EmptyState` | 결과 0건 화면 |
| `shared/ui/PageFallback` | 라우트 lazy 로딩용 전체 스피너 |
| `shared/ui/LinkButton` | 버튼처럼 보이는 링크. **화면 이동은 `onClick` + navigate 대신 이걸 쓰세요** |
| `shared/ui/AuthLinkButton` | 로그인해야 갈 수 있는 곳으로 보내는 단추 (C01). 비로그인이면 가지 않고 모달을 띄웁니다 |
| `shared/ui/TileCard` | 격자에 반복되는 타일 (브랜드 · 노트 · 컬렉션). 이미지 슬롯 · 제목 · 한 줄 캡션 |
| `shared/ui/PillFilter` | 어둠 위에 놓이는 알약 필터. `required` 면 해제가 없습니다 — 밝은 화면은 `ChipToggle` |
| `shared/ui/Pagination` | 쪽 넘김. `page` 는 **0부터**(백엔드와 같습니다) · 번호 다섯 개 · 한 쪽뿐이면 안 그립니다 |
| `shared/ui/BottleSilhouette` | 사진이 없는 향수병 자리에 세우는 실루엣. 색은 `currentColor` 로 부르는 쪽이 정합니다 |
| `shared/ui/DiveCurtain` | 메인에서 진열대로 넘어가는 잠수 커튼 (진열대 · 메인 담당) |
| `shared/ui/WaterCaustics` | 물결 — 어두운 방 위에 깔리는 수면 빛 그물(three.js 셰이더). 라우트 `handle.caustics` 로 켭니다 (docs/어두운-방-유리판.md) |

variant 로 표현할 수 있는 차이는 새 컴포넌트를 만들지 않고 **variant 를 추가**합니다
(`class-variance-authority` 사용). `PrimaryButton`, `SmallButton` 같은 파생 컴포넌트를 만들지 않습니다.

## 공용 훅 인벤토리

| 훅 | 용도 |
| --- | --- |
| `shared/hooks/useToast` | 토스트 한 개의 열림 상태. `const { showToast, toastProps } = useToast()` 후 `<Toast {...toastProps} />` |
| `shared/hooks/useLikeToggle` | 좋아요 토글 (CMT-05). 비로그인이면 보내지 않고 안내부터 — 캐시를 고치는 일은 화면이 맡습니다 |
| `shared/hooks/useUnroll` | 족자처럼 풀리는 열림. **쓰는 쪽을 조건부로 렌더해야** 다음에 열 때 다시 풀립니다 |
| `shared/hooks/useDiveReady` | 잠수 커튼에 "화면이 다 섰다" 를 알립니다 (진열대 · 메인 담당) |

`onClose` 를 인라인 화살표로 넘기면 `Toast` 의 타이머가 렌더마다 초기화되어 토스트가
사라지지 않습니다. 이 훅이 `useCallback` 으로 그 문제를 막아주니 직접 `useState` 로
관리하지 마세요.


## 스타일 규칙

- 색·radius·폰트는 `src/styles/index.css`의 `@theme` 토큰만 씁니다.
  `bg-brand-600`, `text-ink-muted`, `rounded-card` — `#3f5337`이나 `bg-[#67855a]`는 쓰지 않습니다.
  디자인 시안이 확정되면 `@theme` 값만 교체해 전체에 반영합니다.
- 공용 컴포넌트에서 `className` 을 받을 때는 반드시 `cn()`(`shared/lib/cn.ts`)으로 합칩니다.
  문자열을 이어붙이면 호출하는 쪽이 기본 스타일을 덮어쓸 수 없습니다.
- 클래스 순서는 `prettier-plugin-tailwindcss`가 정리합니다. 손으로 맞추지 않습니다.

### 화면 폭 · 치수는 1920 x 1080 기준입니다

1920 이 가장 넓은 규격이고(피그마 "1920w" 아트보드), 거기서 줄어드는 방향으로 반응형을 맞춥니다.

**치수는 1920 에서 적고, 좁은 화면에는 `--spacing` 이 비율로 줄여 옮깁니다.** Tailwind 의 치수
유틸리티는 전부 `calc(var(--spacing) * n)` 이라, `styles/index.css` 의 `--spacing` 하나가 화면의
모든 상자와 사이를 잡는 기준자입니다. 1920 에서 4px 이고 1536 에서 3.2px(80%) 까지 따라 줄어든
뒤 멈춥니다 — 1536 x 864 는 1920 x 1080 의 125% 배율 화면이라, 1920 에서 맞춘 짜임이 거기서
80% 크기로 그대로 나옵니다.

- **글자 크기는 줄지 않습니다** (`--text-*` 는 rem 고정). 상자만 줄고 글자는 그대로라 **좁은
  상자에서 글자가 먼저 넘칩니다** — 단추 · 배지 · 한 줄 자르기는 1920 과 1536 을 다 보고 정합니다.
- 좌우 여백은 `--gutter` 를 씁니다(`styles/index.css`). 1280~ 48 · 1024~ 40 · 768~ 30 · 그 아래 20 이고,
  1536 위로는 단 없이 화면 폭을 따라 48 에서 1920 의 60 까지 벌어집니다 — **1536 의 48 은 1920 의
  60 에 `--spacing` 과 같은 비율(0.8)** 입니다. 헤더와 본문이 같은 값이라 로고와 본문 왼쪽 끝이 맞습니다.
- 본문 폭은 네 가지이고, 화면마다 `app/router` 의 `handle.width` 에 한 번만 적습니다(적지 않으면 `wide`).

  | 폭 | 크기 | 쓰는 곳 |
  | --- | --- | --- |
  | 폭 | 1920 | 1536 | 쓰는 곳 |
  | --- | --- | --- | --- |
  | `full` | 화면 틀 전체(1800) | 화면 틀 전체 | 진열대 · 향 지도처럼 화면을 그림으로 쓰는 곳 |
  | `wide` | 1440 | 1152 | 목록 · 격자 · 상세 |
  | `text` | 800 | 640 | 글 읽기 · 쓰기, 계정 폼 (한글 한 줄 40자 안팎) |
  | `bleed` | 화면 끝까지 · 헤더 뒤까지 (틀 · 여백 없음). 헤더는 그 위에 유리판으로 뜹니다 | | 3D 향 지도(A01) — 엔진이 화면 전체를 그림으로 씁니다 (`landing/`) |

  본문 폭도 `--spacing` 과 같은 비율(제 값의 1920 분의 1)로 줄어듭니다. 고정 폭이면 1536 에서
  `wide` 1440 이 쓸 수 있는 폭(1416)보다 넓어 늘 최대로 펴지고, 본문이 화면 끝에 붙습니다.

  페이지 안에서 음수 마진으로 폭 제한을 깨고 나가지 않습니다. 넓게 써야 하면 라우트에 `full` 을 적습니다.
- 요소 치수(폭 · 높이 · 간격)는 **1920 기준으로 적고** 끝자리를 **0 또는 5** 로 맞춥니다.
  1~3px 선 굵기 같은 세부는 예외입니다. 좁은 화면에서 계산된 값이 0 · 5 로 안 떨어지는 것은
  `--spacing` 이 비율로 줄인 결과라 그대로 둡니다 — 규칙은 **적는 값**에 대한 것입니다.
  **글자 크기는 이 규칙에서 뺍니다** — 활자 스케일(`@theme` 의 `--text-*`)과 기존 임의 크기를 그대로 둡니다.
- `h-[180px]` 처럼 임의값 px 로 치수를 박으면 `--spacing` 을 타지 않아 그 자리만 안 줄어듭니다.
  치수는 유틸리티(`h-45`)로 적고, 임의값이 꼭 필요하면 `--spacing` 을 곱해 씁니다.
- 화면을 확인할 때는 **1920 x 1080 과 1536 x 864 를 둘 다** 봅니다. 1920 은 clamp 의 위끝이라
  기준이고, 1536 은 아래끝이라 글자가 상자에 부딪히는지가 거기서 드러납니다.

## 3D 향 지도 엔진 (`landing/`)

메인(`/`)의 3D 화면은 `landing/index.html` 을 iframe 으로 띄운 것입니다(`features/map/components/ScentScene.tsx`).
엔진은 three.js 로 만든 프로토타입 paperboat 에서 옮겨 온 것이고(**원본은 이제 이 폴더입니다** — 아래 참고), Vite 의 두 번째 입구(`vite.config.ts` 의
`build.rolldownOptions.input.landing`)로 앱과 같이 빌드됩니다.

- React · TypeScript 가 아닌 순수 JS 입니다. **ESLint · Prettier 검사에서 뺐고**, 엔진 코드의 규칙은 `landing/CLAUDE.md` 를 따릅니다.
- 배 모델 · 게이트 그림은 `public/landing/` 에 있습니다. 엔진이 페이지 기준 상대 경로로 부릅니다.
- 앱과 주고받는 문은 엔진의 `landing/src/host.js` 하나입니다(자세히 보기 · 진열대에 저장 · 주변 향 탐색 · 검색창). 앱 쪽 연결은 `ScentScene` 에 모았습니다.
- 엔진의 개발 패널(계측 HUD · 파라미터 슬라이더 · 조작 바 · 시점 · 원본 비교 · 자유 시점 · 부력 프로브 · 프레임 잡기)은 **develop 에 넣지 않습니다** — 개발 서버에서도 노출되지 않게 모듈째 뺐고, 엔진 작업자의 작업 브랜치에만 있습니다. 엔진만 따로 보려면 `/landing/index.html` 을 엽니다.
- 메인의 헤더는 **거의 투명한 유리**입니다 — `bleed` 화면이면 `RootLayout` 이 3D 하늘에 따라 `GlobalHeader` 에 `tone="glassLight"`(밝은 하늘 · 상아색 판 · 먹색 글자) 또는 `tone="glass"`(밤 · 남색 판 · 상아색 글자)를 줍니다. 하늘은 `HomePage` 가 엔진의 `<html data-time>` 을 받아(`ScentScene` 의 `onNightChange`) `shared/store/sceneSkyStore` 에 적습니다.
  3D 가 헤더 뒤까지 깔리고, 헤더가 가리는 90px 은 `ScentScene` 의 `coveredTop` → 엔진 `hostTop` 으로 알립니다. 엔진은 검색창 · 정보 블록 · 해도를 그 아래로 내리고 향수 고르기의 12개를 그 띠에 세우지 않습니다.
  엔진의 자리표시 헤더(`siteHeader`)는 끕니다 — 무대를 헤더만큼 줄이는 방식이라 유리판 뒤가 비어 버립니다. 헤더 높이를 바꾸면 `coveredTop` 도 같이 바꿉니다.
- **로딩 커튼** (2026-09-17) — 메인에 들어오면 흰 바탕에 짙고 작은 점이 차례로 연막탄처럼 터져 향 원 세 개(대 왼쪽 — 원 모양 마스크 안에서 물빛 · 금빛 · 세이지가 번짐 · 중 오른쪽 위 금빛 한 색 · 소 오른쪽 아래 물빛 한 색)로 번지고, 화면 가운데에 '향해' 글자가 그려지고 그 아래 굵은 퍼센트(Noto Serif KR 900)가 자리마다 굴러 올라가며 주황(`--color-dusk-orange`)에서 남색으로 바뀌다가 5초 안팎에 걷힙니다.
  **엔진이 뜨는 동안 메인 스레드가 1~3초 막힙니다**(엔진 iframe 이 같은 스레드). 그래서 커튼의 움직임은 전부 합성 단계 애니메이션입니다 — 원은 CSS 애니메이션(시각 기준), 퍼센트는 `lib/bootCounter.ts` 가 앞으로 4초 치 흐름을 미리 계산해 Web Animations 로 넘깁니다. 자바스크립트로 매 장 값을 밀면 막힌 동안 멈춥니다.
  첫 진입은 `index.html` 의 `#boot`(React 전 · head 의 `<style>`)가 흰 바탕과 세 원을 그리고, `features/map` 의 `SceneBootCurtain` 은 그 위에 퍼센트만 얹었다가 같이 걷습니다(`useSceneBoot` · 진행률 모델 `lib/bootProgress.ts` · 원 · 칸 `scene-boot.css`). 앱 안에서 다시 들어오면 `SceneBootCurtain` 이 세 원을 두 배 빠르게 그립니다. `#boot` 와 `scene-boot.css` 의 원은 자리 · 크기 · 색 · 시각이 같아야 합니다 — 한쪽을 고치면 다른 쪽도 봅니다. 퍼센트 글꼴은 `index.html` 의 `&text=` 링크(숫자 · % 만)입니다.
  **'향해' 글자** (2026-09-18) — 대 원이 터진 직후(0.9초)부터 2초 동안 쓰는 순서대로 그려집니다. 보이는 것은 아웃라인(면 · 남색)이고, 중앙패스를 굵게 칠한 마스크가 자라며 그 면을 드러냅니다(애프터이펙트의 트림 패스 + 루마 매트). 획 하나 = 마스크 하나 = 면 하나이고, 두 SVG 는 사용자가 그린 것입니다(`lib/bootWordmark.ts` 의 `WORDMARK_PARTS` 13쌍 · 아트보드 1920×1080).
  자리 : SVG 의 틀(viewBox)이 **글자 테두리**(`WORDMARK_BOX`)라 상자가 곧 글자입니다 — 화면 가운데에 놓고 폭(`--boot-word-w`)만 정합니다(1920 에서 460px · 좁은 화면은 74vw 까지). 퍼센트는 그 아래에 매달려 글자 폭의 0.2 배로 섭니다. ⚠ 마스크 영역(x · y · width · height)도 같은 상자로 못 박습니다 — `userSpaceOnUse` 의 기본 영역은 좌표 원점에서 잰 −10%~120% 라, 글자가 원점에서 떨어져 있으면 **통째로 가려집니다**.
  마스크를 자라게 하는 `stroke-dashoffset` 은 합성 스레드가 못 다뤄 **엔진이 막는 동안 획이 섭니다**. 그래서 시각을 흐른 시간이 아니라 **그려진 장**으로 재고(`wordmarkDashoffsets`), 막힘이 풀리면 멈춘 자리에서 이어 그립니다 — Web Animations 로 넘기면 막힌 1~2초 사이에 글자가 다 그려져 버려 그리는 모습이 사라집니다. 커튼은 다 그릴 때까지 1.2초까지 기다렸다 걷습니다.
  엔진이 `postMessage({type:'pb:boot', stage})` 로 부팅 단계(html → script → frame → boat-bytes → boat)를 알리고(`landing/src/host.js` `bootReport`), `ScentScene` 의 `onBoot` 가 받습니다. `ScentScene` 은 엔진 주소를 두 장 뒤에 넣습니다 — 커튼이 먼저 합성 스레드로 넘어가게.
  퍼센트는 **페이스 곡선과 "실제 진행 + 조금" 중 작은 값을 느슨하게 따라갑니다** — 목표 아래면 최소 속도로 오르고, 목표에 닿아도 조금 더 기어가며, 100 은 다 떴을 때만입니다. ⚠ 숫자 칸 하나에는 transform 애니메이션을 하나만 둡니다(둘이 겹치면 크롬이 합성 스레드로 못 넘겨 막힌 동안 섭니다).
- **진열대로 넘어가는 잠수 전환** (2026-09-18) — 메인에서 헤더 '진열대' 를 누르면 곧바로 옮겨 가지 않고, 3D 카메라가 수면으로 고개를 숙이며 다가가는 1초 동안 화면 아래에서 **짙은 바다색이 차올라** 덮은 뒤 진열대로 넘어가 걷힙니다.
  시계는 **앱이 쥡니다** — `shared/ui/DiveCurtain` 이 rAF 안에서 진행도 `k`(0~1)를 커튼(CSS 변수)과 엔진(`PB.dive(k)` · `landing/src/dive.js`)에 **직접** 씁니다. React 상태로 올리면 초당 60번 앱 전체가 다시 그립니다.
  갈래 : `shared/lib/diveTrack.ts`(시계 · 곡선) · `shared/store/diveStore.ts`(단계 — 헤더가 걸고, `ScentScene` 이 엔진 문을 꽂고, 진열대가 `useDiveReady` 로 준비를 알립니다) · `shared/ui/dive-curtain.css`(그라데이션 · **아래끝에 못 박고 `scaleY` 로 자랍니다** — 높이 180% 와 굳은 구간 58% 가 한 묶음이고, 그 높이가 곧 '3D 가 얼마나 오래 보이는가' 입니다).
  **걷힐 때는 안개가 걷히듯 아래에서부터 트입니다** — 쓸기 겹(`-sweep`)과 상쇄 겹(`-hold`)이 서로를 지우며 움직여(±300vh) **마스크의 경계만** 지나가고, 상쇄 겹의 `backdrop-filter` 가 트이는 자리 뒤를 흐려 진열대가 흐린 채로 드러났다 또렷해집니다. `mask-position` 을 미는 것은 칠하기 단계라 안 씁니다.
  ⚠⚠ **`mask-clip` 의 기본값은 `border-box` 라 마스크를 단 겹의 상자 밖이 통째로 잘립니다** — 그래서 쓸기 겹의 **높이가 마스크 길이(400vh)와 같아야** 합니다. 창 높이짜리 겹에 `mask-size` 로 늘렸더니 그라데이션이 아니라 **상자의 하드 컷**이 화면을 쓸어 '무대 커튼' 이 됐습니다 (2026-09-18 실측).
  **덮인 채로 머무는 동안 물결이 숨을 쉽니다**(`-drift`) — 메인 로딩 커튼이 배 GLB 를 기다리며 구름을 숨 쉬게 하는 것과 같은 장치입니다. 진열대가 무거워 잔류가 길어서(최소 0.42초 · 상한 2.60초) 납작한 남색 한 장이면 '멈춤' 으로 읽힙니다. 준비 신호는 데이터가 온 **다음 장이 칠해진 뒤**에 갑니다 (`useDiveReady` 의 rAF 두 번).
  커튼은 **`RootLayout`** 에 섭니다 — 화면 안에 두면 경로가 바뀌는 순간 같이 사라져 아이보리 바탕이 드러납니다.
  **왜 커튼인가** : 3D 의 바다는 위에서만 그려지는 판 한 장이라 카메라를 수면 아래로 내리면 물이 종이처럼 사라집니다. 그래서 카메라는 수면 위에 남고 물속은 이 판이 맡습니다 (`landing/docs/고도화-0917/03-로딩-전환-수중.md` §4).
  ⚠ 엔진의 `params.diveDeep` 과 앱의 `--color-navy` 는 **같은 값**이어야 합니다 — 갈라지면 커튼이 덮는 순간 색이 한 번 튑니다. 값을 만지는 손잡이는 엔진 `params.js` 의 `dive*` 묶음입니다 (`diveDim` · `diveSkyOff` · `diveFade` · `diveEndY` … · `diveAmount 0` 이 전체 롤백).
  ⚠ **이어서 할 일과 이미 밟은 함정은 `landing/docs/다음-세션.md` 맨 위**에 있습니다 (남은 것은 진열대와의 색 연결 하나입니다).
  ⚠ 진열대에서 메인으로 **돌아오는** 연출은 없습니다 — 돌아가면 엔진이 처음부터 다시 뜨고 로딩 커튼이 그 자리를 덮습니다. 넣으려면 '엔진을 살려 두기' (그 문서 §3-1 의 6) 결정이 먼저입니다.
- **원본은 이 폴더(`landing/`)입니다** (2026-09-15 결정). paperboat 저장소는 v0.63.0 에서 멈췄고 v0.64 부터는 여기에만 있으므로, paperboat 에서 가져와 덮어쓰지 않습니다.
- 메인 3D 를 여러 워크트리로 나눠 작업할 때의 갈래 · 맡는 파일 · 통합 순서는 `landing/docs/워크트리-분할.md` 를 따릅니다.

## 서버 상태 vs 클라이언트 상태

React 를 처음 다룰 때 가장 많이 틀리는 지점입니다.

| | 담당 | 예 |
| --- | --- | --- |
| **서버에서 받아온 데이터** | TanStack Query | 향수 목록, 상세, 후기, 컬렉션 |
| **클라이언트가 소유한 상태** | Zustand (`shared/store/`) | 로그인 토큰, 모달 열림 여부 |

서버 데이터를 Zustand 에 넣지 않습니다. 넣는 순간 캐싱·중복 요청 제거·재요청·로딩/에러
상태를 직접 만들게 되는데, 그게 TanStack Query 가 이미 하는 일입니다.

쿼리 작성은 `features/perfume/queries.ts`의 `perfumeKeys` + `queryOptions` 패턴을 따릅니다.
쿼리 키를 객체로 모아두면 `invalidateQueries({ queryKey: perfumeKeys.all })`로 하위를 한 번에 갱신할 수 있습니다.

## 새 화면 만드는 순서

1. `shared/config/routes.ts`에 경로 상수 추가 (동적 경로면 `toXxx()` 헬퍼도)
2. `pages/XxxPage.tsx` 생성 — **default export**
3. `app/router/index.tsx`에 `lazy()` + `withSuspense()` 로 등록
4. 서버 데이터가 필요하면 `features/<도메인>/`에 `types.ts` → `api.ts` → `queries.ts` → `index.ts` export
5. 화면에서 `useQuery(도메인Query(...))` 로 사용
6. 로딩은 `Skeleton`, 0건은 `EmptyState`, 에러는 메시지 표시까지 반드시 함께 처리

`pages/PerfumeDetailPage.tsx` + `features/perfume/`가 1~6번을 관통하는 참고 구현입니다.

## 주석 규약

주석은 **왜(Why)** 를 적는 자리입니다. **무엇을(What)** 하는지는 이름으로 말합니다 —
주석을 달고 싶어지면 함수명 · 변수명으로 풀 수 있는지 먼저 봅니다.

코드를 고치면 주석도 같이 고칩니다. **틀린 주석은 없는 것보다 해롭습니다.**

### 남기는 주석

| | 예 |
| --- | --- |
| **함수 · 컴포넌트 계약** — JSDoc 으로, `@param` · `@returns` 를 씁니다 | 아래 예시 |
| **비즈니스 규칙 · 기획 예외** — 모르면 지우거나 고칠 코드 | `가입 7일 안에는 수신 거부여도 웰컴 쿠폰을 보냅니다(기획 v1.2)` |
| **우회 · 최적화의 까닭** — 안 적으면 "리팩토링 대상" 으로 오해받는 코드 | `Tailwind v4 preflight 가 기본 outline 을 지워 링을 직접 답니다` |

```ts
/**
 * 주소의 쪽 번호를 읽습니다. **주소는 1부터, 안에서는 0부터** 셉니다.
 *
 * @param params 화면의 `useSearchParams` 값
 * @returns 0부터 세는 쪽 번호. 숫자가 아니거나 범위를 벗어나면 0
 */
```

### 걷는 주석

- **코드를 그대로 옮겨 적은 것** — `const name = ...` 위의 `// 이름을 담습니다`
- **히스토리** — "전에는 ~ 했습니다", "2026-09-16 에 바꿨습니다". `git log` 가 합니다
- **주석 처리된 코드** — 지웁니다. 되살릴 것은 git 에 다 있습니다
- **구역 나누기 선** — `/* ------- */`. 파일이 그만큼 길면 파일을 가릅니다

### 태그는 표준만 씁니다

IDE 와 `grep` 이 찾을 수 있어야 합니다.

```ts
// TODO: 프로필 이미지 업로드 연결 (S15P21E203-000)
// FIXME: 목록이 길어지면 매 글자마다 다시 거릅니다
// NOTE: 이 값은 엔진 params.js 의 diveDeep 과 같아야 합니다
```

- `TODO:` 아직 안 한 일. **이슈 키를 같이 적습니다** — 없으면 이슈부터 만듭니다
- `FIXME:` 돌긴 하는데 고쳐야 하는 것
- `NOTE:` 읽는 사람이 놓치기 쉬운 주의점

`⚠` · `⭐` 같은 표시는 쓰지 않습니다. 눈에는 띄지만 검색이 안 되고 등급도 없습니다.

## 테스트

- 파일 위치는 **대상 파일 옆**입니다. `Button.tsx` → `Button.test.tsx`. `__tests__/` 폴더는 쓰지 않습니다.
- `describe`/`it`/`expect`/`vi` 는 `vitest`에서 명시적으로 import 합니다(전역 사용 안 함).
- **클래스명이나 내부 상태를 검사하지 않습니다.** `getByRole('button', { name: '저장' })`처럼
  사용자가 보고 조작하는 기준으로 찾습니다. 마크업을 바꿔도 테스트가 안 깨지고 접근성 문제도 같이 잡힙니다.
- 작성 예시는 `src/shared/ui/Button.test.tsx`입니다.
- 최소 기준: 공용 컴포넌트(`shared/ui/`)와 순수 함수(`shared/lib/`)는 테스트를 함께 만듭니다.
  화면 전체 테스트는 필수가 아닙니다.

## 하지 말 것

- `../../../shared/api/http` 같은 상대 경로 — `@/shared/api/http` 를 씁니다.
- 경로에 `/api/v1` 붙이기 — `http` 인스턴스의 baseURL 에 이미 있습니다. `http.get('/perfumes')`.
- `import.meta.env` 직접 읽기 — `shared/config/env.ts` 에서만 읽습니다.
- 경로 문자열 하드코딩 — `shared/config/routes.ts` 의 `ROUTES` 를 씁니다.
- `console.log` — lint 경고이고 경고도 빌드 실패입니다. `console.warn`/`console.error` 만 허용됩니다.
- `any` 로 타입 회피 — 백엔드 응답이 불확실하면 `unknown` 후 좁히거나 타입에 주석으로 남깁니다.

## 백엔드와 화면이 붙은 정도

**주석을 믿지 말고 백엔드 소스를 먼저 확인하세요.** 이 문단은 금방 낡습니다 — 인증·회원과
노트가 한 번 틀린 채로 남아 있었고, 그 뒤 **파일 업로드와 닉네임 변경도 "없다" 고 적힌 채로
생겼습니다.** 없다고 적혀 있으면 다음 사람이 찾아보지도 않으니, 붙일 때 이 문단을 같이
고쳐 주세요.

게시글 이미지 첨부도 붙었습니다(S15P21E203-368) — `features/community/ImageAttachField` 가 고른
사진을 먼저 올리고, 글을 저장할 때 그 주소를 `imageUrls` 로 넘깁니다. ⚠️ **후기에는 이미지가
없습니다** — `ReviewCreateRequest` 가 제목 · 본문 · 계절만 받습니다.

향수·브랜드·후기는 대부분 붙어 있고, **인증·회원도 붙었습니다**(로그인 · 회원가입 · 내 정보 ·
닉네임 중복 확인 · 닉네임 변경 · 비밀번호 변경 · 탈퇴 · 로그아웃 · 토큰 재발급).

아직 **백엔드에 없는** 것은 하나입니다.

- 비밀번호 재설정 (A31) — 화면만 있고 `PasswordResetForm` 에 NOTE 두 곳. 붙일 계획이
  없어 TODO 가 아닙니다 — 두 폼은 눌러도 서버로 아무것도 가지 않습니다

프로필 사진도 붙었습니다(S15P21E203-404) — `features/auth/ProfileImageField` 가 고른 사진을
`POST · DELETE /users/me/profile-image`(multipart, 필드 `file`) 로 보내고, 정보 변경 화면과
헤더 아바타가 `meQuery` 캐시 하나를 같이 봅니다. 제한은 **JPG · PNG · GIF · WEBP · 1MB** 이고
형식을 파일 내용으로 판별합니다 — 화면에서 미리 거르지 않고 서버 문구(413 · 415)를 그대로 보여줍니다.

⚠️ **작성자 사진은 아직 못 붙입니다.** `profileImageUrl` 이 `UserResponse` 에만 있어서 내 사진만
알 수 있습니다. 후기 · 게시글 · 댓글 응답(`ReviewDetailResponse` · `ReviewResponse` ·
`ReviewBoardItemResponse` · `PostDetailResponse` · `PostSummaryResponse` · `CommentResponse`)에
필드를 추가해 달라고 요청해 두었고, 오면 그 자리의 `NOTE:` 를 걷으면 됩니다.

붙어 있는 API 도 **값이 비는 필드가 많습니다** — `nameKo`·`imageUrl`·`scentFamily`·`logoUrl` 은
null 로 옵니다. **타입이 필수라고 믿고 바로 접근하면 화면이 죽습니다.** 값 없는 경우를 먼저
처리하고, 없는 API 를 임시로 채울 때는 `shared/api/withDevFallback` 로 감싸 개발 환경에서만
끼어들게 하세요. 운영에서 자리표시자가 나가면 버그가 가려집니다.
