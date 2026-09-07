# 향해 Frontend

React + TypeScript + Vite 기반 프론트엔드입니다.

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
| **`npm run verify`**   | **format:check → lint → typecheck → build 전부 실행. MR 올리기 전에 이것만 통과시키면 됩니다.** |

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
├── types.ts        API 요청/응답 타입
├── api.ts          http 호출 함수 (순수 함수, 컴포넌트 몰라도 됨)
├── queries.ts      queryKey + queryOptions / useMutation
├── hooks/          이 도메인 전용 훅
└── components/     이 도메인 전용 컴포넌트
```

**규칙 하나만 지켜주세요: `features/a` 가 `features/b` 를 import 하지 않기.**
두 도메인이 같이 필요하면 `shared/` 로 올리거나 `pages/` 에서 조합합니다.
서로 물고 물리기 시작하면 나중에 아무도 못 건드립니다.

## 컨벤션

- **파일명**: 컴포넌트는 `PascalCase.tsx`, 나머지는 `camelCase.ts`
- **import 경로**: `@/` alias 사용 (`import { http } from '@/shared/api/http'`). `../../../` 금지
- **import 순서**: 외부 → `@/` 내부 → 상대경로. `npm run lint:fix` 가 자동 정렬합니다
- **타입 import**: `import type { X }` 로 (ESLint 가 자동 수정)
- **`any` 금지**: 모르면 `unknown` 쓰고 좁혀서 사용
- **서버 데이터는 useState 에 담지 않기**: 전부 TanStack Query 로. Zustand 는 로그인 정보·UI 토글 같은 클라이언트 상태만
- **`console.log` 는 경고**: `npm run lint` 가 실패하므로 커밋 전에 지워주세요

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

- [ ] Git hook (husky + lint-staged) — 커밋 시 자동 검사. `frontend/` 가 모노레포 하위라 루트에서 설정해야 해서 팀 합의 후 진행
- [ ] 테스트 도구 (Vitest + Testing Library) 도입 시점
- [ ] Jenkinsfile 에 frontend 빌드 스테이지 추가 (현재는 backend 만 있음)
- [ ] 디자인 시안 확정 후 `src/styles/index.css` 의 `@theme` 토큰 교체
