# 향해 Frontend

React + TypeScript + Vite 기반 프론트엔드입니다.

> **처음 오셨다면** `docs/프론트엔드-초기-설정-가이드.md` 부터 읽어주세요 (설치·환경변수·자주 막히는 지점).
> 이 문서는 **작업 중에 찾아보는 규약 요약**입니다.
> 같은 규약을 Claude Code 도 참조하도록 `CLAUDE.md` 에 정리해 두었습니다 — 두 문서 내용은 같습니다.

## ⚠️ 작업 범위는 `frontend/` 안으로 한정됩니다

FE 팀이 수정하는 파일은 **`frontend/` 폴더 안에 있는 것뿐입니다.**
저장소 루트, `backend/`, `ai/`, `docs/`, `Jenkinsfile`, `compose.*.yaml`, `.gitlab/`, `TIL/` 은
다른 파트 담당이므로 건드리지 않습니다.

`frontend/` 밖이 바뀌어야 하는 일이 생기면 **직접 고치지 말고 해당 파트에 요청해주세요.**
예를 들어 Jenkins 파이프라인에 프론트엔드 검증 스테이지를 추가하는 작업은 `Jenkinsfile` 수정이
필요하므로 infra 담당자의 작업입니다. 프론트엔드 MR 에는 `frontend/` 밖 변경이 섞이지 않도록 합니다.

MR 올리기 전에 확인하는 방법:

```bash
git diff --name-only origin/develop...HEAD | grep -v "^frontend/"
```

아무것도 출력되지 않아야 정상입니다.

## 시작하기

```bash
cd frontend
cp .env.example .env.local   # Windows: copy .env.example .env.local
npm ci                       # package-lock.json 그대로 설치 (팀원 전원 동일 버전 보장)
npm run dev                  # http://localhost:5173
```

> `npm install` 대신 **`npm ci`** 를 쓰세요. `npm install` 은 lock 파일을 갱신해서
> 사람마다 다른 버전이 깔릴 수 있고, 그게 "제 컴퓨터에선 되는데요" 의 원인입니다.
> 새 패키지를 추가할 때만 `npm install <패키지>` 를 쓰고, 바뀐 `package-lock.json` 을 **꼭 함께 커밋**하세요.

**Node 22.12 이상**이 필요합니다 (`package.json` 의 `engines` 참고). `node -v` 로 확인하세요.

## 기술 스택

| 구분      | 선택                        | 이유                                                     |
| --------- | --------------------------- | -------------------------------------------------------- |
| 빌드      | Vite 8                      | 개발 서버 기동/HMR 이 빠름                                |
| 언어      | TypeScript 6 (strict)       | 백엔드 API 응답 타입을 코드로 고정                        |
| 라우팅    | React Router 8              | 라우트 단위 코드 스플리팅                                 |
| 서버 상태 | TanStack Query 5            | 캐싱·로딩·에러·재요청을 직접 만들지 않음                  |
| 전역 상태 | Zustand 5                   | 보일러플레이트 없이 세션성 상태만 관리                    |
| HTTP      | Axios                       | 인터셉터로 토큰 주입/에러 정규화를 한 곳에서 처리         |
| 스타일    | Tailwind CSS 4              | 카드/리스트 반복 UI 를 빠르게, 디자인 토큰은 CSS 에서 관리 |
| 품질      | ESLint 10 + Prettier 3      | 포맷은 Prettier, 코드 규칙은 ESLint 로 역할 분리          |

## 스크립트

| 명령                   | 설명                                              |
| ---------------------- | ------------------------------------------------- |
| `npm run dev`          | 개발 서버                                          |
| `npm run build`        | 타입 체크 + 프로덕션 빌드                          |
| `npm run preview`      | 빌드 결과물 로컬 확인                              |
| `npm run lint`         | ESLint 검사 (경고 1개라도 있으면 실패)             |
| `npm run lint:fix`     | ESLint 자동 수정 (import 순서 정렬 포함)           |
| `npm run format`       | Prettier 자동 포맷                                 |
| `npm run format:check` | 포맷 검사만                                        |
| `npm run typecheck`    | 타입 검사만                                        |
| `npm run test`         | 테스트 1회 실행 (Vitest)                           |
| `npm run test:watch`   | 테스트 감시 모드. 개발 중에는 이걸 켜두세요        |
| **`npm run verify`**   | **format:check → lint → typecheck → test → build 전부 실행. MR 올리기 전에 이것만 통과시키면 됩니다.** |

## 폴더 구조

```
src/
├── app/                    앱 전역 조립부 (여기는 자주 바뀌지 않습니다)
│   ├── layouts/            공통 레이아웃 (헤더/푸터/Outlet)
│   ├── providers/          QueryClientProvider, RouterProvider
│   └── router/             라우트 정의 + lazy 로딩
├── pages/                  라우트 1:1 화면 컴포넌트 (default export)
├── features/               도메인별 슬라이스 ★ 실제 작업은 대부분 여기서
│   ├── auth/               COM-01~06 회원가입/로그인/회원탈퇴
│   ├── map/                MAP-01~24 향 지도
│   ├── perfume/            COM-05, DTL-01~25 향수 검색/상세/후기  ← 참고 구현
│   ├── recommend/          REC, NLR, TST 추천/자연어/취향테스트
│   ├── collection/         COL-01~08 컬렉션
│   ├── shelf/              SHF-01~14 진열대/시향 기록
│   └── community/          CMT-01~16 게시글/댓글
├── shared/                 도메인에 종속되지 않는 공통 코드
│   ├── api/http.ts         axios 인스턴스 + 인터셉터
│   ├── config/env.ts       환경변수 (import.meta.env 는 여기서만 읽기)
│   ├── config/routes.ts    경로 상수
│   ├── lib/queryClient.ts  TanStack Query 기본값
│   ├── store/              전역 상태 (authStore)
│   ├── ui/                 버튼·모달 등 공용 컴포넌트
│   ├── hooks/              공용 훅
│   └── types/              공용 타입
├── styles/index.css        Tailwind 진입점 + 디자인 토큰(@theme)
└── assets/                 이미지·폰트
```

### features 슬라이스 규칙

한 도메인 폴더 안에 그 도메인에 필요한 것을 모아 둡니다. `src/features/perfume/` 을 그대로 따라 하세요.

```
features/<도메인>/
├── index.ts        공개 API — 밖에서 쓸 것만 여기서 export
├── types.ts        API 요청/응답 타입
├── api.ts          http 호출 함수 (순수 함수, 컴포넌트 몰라도 됨)
├── queries.ts      queryKey + queryOptions / useMutation
├── hooks/          이 도메인 전용 훅
└── components/     이 도메인 전용 컴포넌트
```

도메인은 `index.ts` 를 통해서만 드나듭니다. 내부 파일을 쪼개거나 옮겨도 화면 코드가 깨지지 않습니다.

```ts
import { perfumeDetailQuery } from '@/features/perfume' // O
import { perfumeDetailQuery } from '@/features/perfume/queries' // X
```

**규칙 하나만 지켜주세요: `features/a` 가 `features/b` 를 import 하지 않기.**
두 도메인이 같이 필요하면 `shared/` 로 올리거나 `pages/` 에서 조합합니다.
서로 물고 물리기 시작하면 나중에 아무도 못 건드립니다.

이 규칙은 **ESLint 가 강제합니다.** 어기면 `npm run lint` 가 실패합니다.
의존 방향은 `app → pages → features → shared` 한 방향이고, 역방향과 도메인 간 교차가 모두 막혀 있습니다.

| 위반 | 결과 |
| --- | --- |
| `shared/` 가 `features/` 를 import | 에러 — 이 코드는 공용이 아니라 해당 도메인 소속입니다 |
| `features/` 가 `pages/`·`app/` 을 import | 에러 — 화면 조립은 `pages/` 에서 합니다 |
| `features/map` 이 `features/perfume` 을 import | 에러 — `shared/` 로 올리거나 `pages/` 에서 조합하세요 |

규칙은 `eslint.config.js` 의 `import-x/no-restricted-paths` 에 있습니다.
**새 도메인 폴더를 만들면 같은 파일의 `FEATURE_DOMAINS` 배열에도 추가해야** 검사가 걸립니다.

## 컨벤션

- **파일명**: 컴포넌트는 `PascalCase.tsx`, 나머지는 `camelCase.ts`
- **import 경로**: `@/` alias 사용 (`import { http } from '@/shared/api/http'`). `../../../` 금지
- **import 순서**: 외부 → `@/` 내부 → 상대경로. `npm run lint:fix` 가 자동 정렬합니다
- **타입 import**: `import type { X }` 로 (ESLint 가 자동 수정)
- **`any` 금지**: 모르면 `unknown` 쓰고 좁혀서 사용
- **서버 데이터는 useState 에 담지 않기**: 전부 TanStack Query 로. Zustand 는 로그인 정보·UI 토글 같은 클라이언트 상태만
- **`console.log` 는 경고**: `npm run lint` 가 실패하므로 커밋 전에 지워주세요
- **화면을 만들기 전에 `shared/ui/` 를 먼저 보기**: 버튼·입력창·카드·모달은 이미 있습니다 (아래 표)
- **색·radius 는 디자인 토큰만**: `bg-brand-600`, `text-ink-muted`, `rounded-card`. `#3f5337` 이나 `bg-[#67855a]` 금지
- **테스트 파일은 대상 파일 옆에**: `Button.tsx` → `Button.test.tsx`. `__tests__/` 폴더는 쓰지 않습니다

## 공용 UI 컴포넌트

새로 만들기 전에 `src/shared/ui/` 에 있는지 먼저 확인하세요.

| 컴포넌트 | 용도 |
| --- | --- |
| `Button` | `variant` primary·secondary·outline·ghost·danger / `size` sm·md·lg·icon / `isLoading` |
| `Input` | 라벨·에러·hint·접근성 속성 포함 (라벨은 필수 prop) |
| `Card` | 목록에 반복되는 박스. `interactive` 로 호버 효과 |
| `Badge` | 향 계열·상태 같은 짧은 라벨. `tone` brand·neutral·success·warning·danger |
| `Modal` | 네이티브 `<dialog>` 기반. 포커스 가두기·Esc·배경 스크롤 잠금 자동 |
| `Skeleton` | 로딩 중 자리 잡기. 목록에는 스피너보다 이걸 씁니다 |
| `EmptyState` | 결과 0건 화면 |
| `PageFallback` | 라우트 lazy 로딩용 전체 스피너 |

```tsx
import { Button } from '@/shared/ui/Button'

<Button variant="primary" size="lg" isLoading={isSubmitting}>저장</Button>
```

스타일 차이는 새 컴포넌트를 만들지 않고 **variant 를 추가**합니다.
`PrimaryButton`, `SmallButton` 같은 파생 컴포넌트는 만들지 않습니다.

공용 컴포넌트에서 `className` 을 받을 때는 반드시 `cn()`(`shared/lib/cn.ts`)으로 합칩니다.
문자열을 그냥 이어붙이면 호출하는 쪽이 기본 스타일을 덮어쓸 수 없습니다.

### 공용으로 올리는 시점

**예상해서 미리 `shared/` 에 올리지 않습니다.** 처음에는 `features/<도메인>/components/` 에 만들고,
다른 도메인에서 같은 것이 실제로 필요해진 그 시점에 옮깁니다.
옮길 때는 도메인 타입 의존을 끊어야 합니다 — `shared/` 가 `features/` 를 import 하면 ESLint 가 막습니다.

애매하면 항상 도메인 안에 둡니다. 나중에 올리는 건 쉽지만, 잘못 올라간 것을 되돌릴 때는
이미 다른 사람이 그걸 import 한 뒤입니다.

## 테스트

```bash
npm run test:watch   # 개발 중
npm run test         # 1회 실행 (verify 에 포함)
```

- 파일 위치는 **대상 파일 옆**입니다 (`Button.tsx` → `Button.test.tsx`).
- `describe`/`it`/`expect`/`vi` 는 `vitest` 에서 명시적으로 import 합니다.
- **클래스명이나 내부 상태를 검사하지 않습니다.** `getByRole('button', { name: '저장' })` 처럼
  사용자가 보고 조작하는 기준으로 찾으세요. 마크업을 바꿔도 테스트가 안 깨지고 접근성 문제도 같이 잡힙니다.
- 작성 예시: `src/shared/ui/Button.test.tsx`
- 최소 기준: `shared/ui/` 공용 컴포넌트와 `shared/lib/` 순수 함수는 테스트를 함께 만듭니다.
  화면 전체 테스트는 필수가 아닙니다.

## API 연동

`VITE_API_BASE_URL` 은 API 명세서의 버전 prefix 를 포함해 `/api/v1` 입니다.
개발 중에는 이 값으로 두면 Vite dev server 가 `/api` 로 시작하는 요청을 `VITE_API_PROXY_TARGET`(기본 `http://localhost:8080`)으로 프록시합니다.
브라우저 기준으로는 same-origin 이라 **로컬 개발에서 CORS 설정이 필요 없습니다.**

각 API 함수는 prefix 를 붙이지 않고 명세서의 리소스 경로만 씁니다. 예를 들어 명세서의
`GET /api/v1/perfumes` 는 `http.get('/perfumes')` 로 호출하면 됩니다.

호출은 항상 `shared/api/http.ts` 의 `http` 인스턴스를 통해서 합니다. 여기서:

- 요청에 `Authorization: Bearer <token>` 자동 주입
- 응답 에러를 `ApiError { status, code, message }` 로 정규화
- 401 이면 자동 로그아웃

`ApiErrorResponse` 의 `{ code, message }` 와 `Page<T>` 페이지네이션 형태는 백엔드와 **확정되었습니다**
(`common/ApiErrorResponse.java`, `common/PageResponse.java`). 두 타입은 그대로 두면 됩니다.
단, **페이지 번호는 0부터 시작**합니다.

에러 `code` 는 백엔드 enum 상수 이름이 그대로 내려옵니다 (예: `PERFUME_NOT_FOUND`).
분기할 때 이 문자열을 쓰세요. 예상 못한 5xx 는 `INTERNAL_ERROR` 로 통일됩니다.

## 버전 관리

모든 패키지는 `package-lock.json` 으로 고정되어 있고, 아래 조합으로 실제 설치·린트·타입체크·빌드·렌더까지 검증했습니다.

- Node 22.22 / npm 10.9
- React 19.2 · Vite 8.2 · TypeScript 6.0 · ESLint 10.9 · Tailwind 4.3
- `npm audit` 취약점 0건, peer dependency 충돌 없음 (`--legacy-peer-deps` 불필요)

패키지를 올릴 일이 생기면 혼자 올리지 말고 팀에 공유 후 `npm run verify` 를 통과시킨 뒤 lock 파일과 함께 커밋해주세요.

## VS Code

`.vscode/extensions.json` 에 권장 확장(ESLint, Prettier, Tailwind IntelliSense, EditorConfig)이 들어 있습니다.
프로젝트를 열면 설치 안내가 뜹니다. 저장 시 자동 포맷 + ESLint 자동 수정이 켜져 있어 포맷 때문에 diff 가 지저분해질 일은 없습니다.

## 다음에 팀과 정할 것

- [x] 테스트 도구 (Vitest + Testing Library) — S15P21E203-116 에서 도입 완료
- [ ] **도메인 담당 분배** — FE 3명이 어느 도메인을 맡을지. 교차 import 금지 규칙이 담당 구분과 직결되므로 먼저 정해야 합니다
- [ ] **Jenkinsfile 에 frontend verify 스테이지 추가** (현재는 backend 만). 브랜치 보호 조건이 "Pipeline 성공 후 병합 필수" 인데 프론트 코드는 파이프라인에서 검증을 전혀 받지 않는 상태입니다
- [ ] 디자인 토큰(`styles/index.css` 의 `@theme`)을 피그마 시안 값으로 확정
- [ ] `Pretendard` 폰트 실제 로드 — 현재 폰트 스택에 선언만 되어 있고 파일·CDN 이 없어 시스템 폰트로 떨어집니다
- [ ] Git hook (husky + lint-staged) — 커밋 시 자동 검사. `frontend/` 가 모노레포 하위라 루트에서 설정해야 해서 팀 합의 후 진행
- [ ] 디자인 시안 확정 후 `src/styles/index.css` 의 `@theme` 토큰 교체
