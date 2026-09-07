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
- Jira Story 제목: `[FE][작업종류] 작업 내용` (작업종류는 `Feature` `Fix` `Refactor` `Test` `Docs` `Chore` — `Design` 은 없습니다)
- 모든 작업 브랜치는 **최신 `develop`에서** 생성합니다. 1 Jira 이슈 = 1 브랜치 = 1 MR.
- `master`·`develop`에 **직접 push 하지 않습니다.** 둘 다 Protected(push No one, force push 불가,
  파이프라인 성공 후 병합 필수, MR 승인 1명 이상)입니다.
- 관련 없는 작업을 한 브랜치에 함께 담지 않습니다. 1 커밋 = 1개의 의미 있는 작업.
- `rebase` 대신 `merge`로 통일합니다. 작업 시작 전과 MR 생성 전에 최신 `develop`을 반영합니다.
- **커밋은 사용자가 요청할 때만** 만듭니다.
- MR 본문은 `../.gitlab/merge_request_templates/Default.md` 템플릿을 채웁니다(읽기만 합니다).
  MR 올리기 전 `npm run verify` 통과가 조건입니다.

## 명령어

```bash
npm run dev          # 개발 서버 (5173, /api 는 localhost:8080 으로 프록시)
npm run test         # 테스트 1회 실행
npm run test:watch   # 테스트 감시 모드
npm run verify       # format:check + lint + typecheck + test + build — MR 전에 반드시 통과
```

`npm run verify`가 MR 통과 기준입니다. lint 는 `--max-warnings=0`이라 경고도 실패입니다.

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
| `shared/ui/Card` | 목록에 반복되는 박스. `interactive` 로 호버 효과 |
| `shared/ui/Badge` | 향 계열·상태 같은 짧은 라벨. `tone` brand·neutral·success·warning·danger |
| `shared/ui/Modal` | 네이티브 `<dialog>` 기반. 포커스 가두기·Esc·배경 스크롤 잠금 자동 |
| `shared/ui/Skeleton` | 로딩 중 자리 잡기. 목록에는 스피너보다 이걸 씁니다 |
| `shared/ui/EmptyState` | 결과 0건 화면 |
| `shared/ui/PageFallback` | 라우트 lazy 로딩용 전체 스피너 |

variant 로 표현할 수 있는 차이는 새 컴포넌트를 만들지 않고 **variant 를 추가**합니다
(`class-variance-authority` 사용). `PrimaryButton`, `SmallButton` 같은 파생 컴포넌트를 만들지 않습니다.

## 스타일 규칙

- 색·radius·폰트는 `src/styles/index.css`의 `@theme` 토큰만 씁니다.
  `bg-brand-600`, `text-ink-muted`, `rounded-card` — `#3f5337`이나 `bg-[#67855a]`는 쓰지 않습니다.
  디자인 시안이 확정되면 `@theme` 값만 교체해 전체에 반영합니다.
- 공용 컴포넌트에서 `className` 을 받을 때는 반드시 `cn()`(`shared/lib/cn.ts`)으로 합칩니다.
  문자열을 이어붙이면 호출하는 쪽이 기본 스타일을 덮어쓸 수 없습니다.
- 클래스 순서는 `prettier-plugin-tailwindcss`가 정리합니다. 손으로 맞추지 않습니다.

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

## 백엔드가 아직 없는 엔드포인트

`features/perfume/api.ts`와 `types.ts` 주석에 적혀 있듯 일부 엔드포인트·필드가 아직 없습니다
(예: `GET /perfumes/{id}` 는 404, `PerfumeSummary.thumbnailUrl`·`scentFamily` 는 undefined 로 옴).
**타입이 필수라고 믿고 바로 접근하면 화면이 죽습니다.** 값 없는 경우를 먼저 처리하고,
새로 API 를 붙일 때는 백엔드 구현 여부를 먼저 확인한 뒤 없으면 같은 형식의 주석을 남깁니다.
