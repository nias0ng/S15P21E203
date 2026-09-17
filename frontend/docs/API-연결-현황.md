# API 연결 현황

백엔드 컨트롤러의 매핑을 전부 뽑고, 프론트의 `http.get/post/put/patch/delete` 호출을 전부 뽑아
맞대 본 결과입니다. 주석이 아니라 **양쪽 소스가 근거**입니다.

- 기준 시점: 2026-09-17 · 브랜치 `feature/fe/S15P21E203-272-note-api`
- 백엔드 컨트롤러 15개 · 엔드포인트 **73개**
- 프론트가 실제로 부르는 것 **49개 (67%)** · 안 부르는 것 **24개**

## 한눈에

| 도메인 | 연결 | 상태 |
| --- | --- | --- |
| 인증 (`/auth`) | 4 / 4 | 완료 |
| 회원 (`/users`) | 4 / 5 | 닉네임 변경만 미연결 |
| 향수 (`/perfumes`) | 6 / 10 | 상세 화면이 쓰는 건 다 붙음. 이웃·유사·언급글·키워드 미사용 |
| 브랜드 (`/brands`) | 1 / 1 | 완료 |
| 후기 (`/reviews`) | 9 / 9 | 완료 |
| 진열대 (`/users/me/shelf-items`) | 11 / 12 | 메모 단건 조회만 미사용(상세에 포함되어 불필요) |
| 컬렉션 (`/users/me/collections`) | 7 / 7 | 완료 (이번 브랜치 작업) |
| 게시글 (`/posts`) | 2 / 7 | **읽기만 붙음. 쓰기·좋아요·삭제 전부 미연결** |
| 댓글 (`/comments`) | 1 / 4 | **목록만 붙음. 작성·수정·삭제 미연결** |
| 노트 (`/notes`) | 3 / 3 | 완료 |
| 향 지도 (`/map`) | 1 / 6 | 취향 테스트용 벡터만 붙음 |
| 향수 조회 기록 (`/perfume-views`) | 0 / 2 | 미연결 |
| 취향 테스트 (`/users/me/taste-test`) | 0 / 2 | **결과를 서버에 저장하지 않는 중** |
| 자연어 추천 (`/recommendations`) | 0 / 1 | **BE·AI 다 완성인데 FE가 고정 예시를 그리는 중** |

---

## 1. 붙어 있는 것

### 인증 · 회원

| 엔드포인트 | 연결 | 프론트 |
| --- | --- | --- |
| `POST /auth/signup` | O | `features/auth/api.ts` |
| `POST /auth/login` | O | 토큰만 받고 `GET /users/me` 를 이어서 호출 |
| `POST /auth/refresh` | O | `shared/api/http.ts` 401 인터셉터 (동시 재발급 1회로 묶음) |
| `POST /auth/logout` | O | |
| `GET /users/nickname-availability` | O | |
| `GET /users/me` | O | |
| `PATCH /users/me/password` | O | |
| `DELETE /users/me` | O | |
| `PATCH /users/me/nickname` | **X** | 아래 2번 참고 — 있는데 안 붙었습니다 |

### 향수 · 브랜드

| 엔드포인트 | 연결 | 비고 |
| --- | --- | --- |
| `GET /perfumes` | O | 목록 · 검색 |
| `GET /perfumes/{id}` | O | |
| `GET /perfumes/{id}/notes` | O | |
| `GET /perfumes/{id}/review-statistics` | O | |
| `GET /perfumes/{id}/review-summary` | O | |
| `GET /perfumes/{id}/season-statistics` | O | |
| `GET /brands` | O | |
| `GET /perfumes/{id}/neighbors` | X | 3D 엔진이 `landing/data` 의 정적 파일로 자체 계산 중 |
| `GET /perfumes/{id}/similar` | X | 같은 이유 |
| `GET /perfumes/{id}/posts` | X | 향수 상세의 "이 향수 언급 글" 자리가 아직 비어 있음 |
| `GET /perfumes/{id}/review-keywords` | X | 키워드 칩 미구현 |

### 후기 — 9개 전부 연결

`POST·GET /perfumes/{id}/reviews` · `GET /reviews` · `GET /reviews/{id}` ·
`PATCH·DELETE /reviews/{id}` · `PUT /reviews/{id}/seasons` · `PUT·DELETE /reviews/{id}/like`

### 진열대 — 12개 중 11개 연결

생성 · 목록 · 상세 · 삭제 · 메모(작성·수정·삭제) · 적합도(설정·삭제) · 대표 지정 · 보유 상태 전부 붙어 있습니다.
`GET /users/me/shelf-items/{id}/memo` 만 안 부르는데, 상세 응답에 메모가 실려 와서 부를 일이 없습니다.

### 컬렉션 — 7개 전부 연결

목록 · 상세 · 생성 · 수정 · 삭제 · 향수 담기 · 향수 빼기. 이번 브랜치에서 붙였습니다.
목록은 서버 페이지네이션(기본 10, 최대 100)을 FE 가 끝까지 돌며 전부 모읍니다.

---

## 2. 백엔드는 있는데 FE 가 안 붙인 것 — 지금 바로 할 수 있는 일

우선순위 순입니다. 24개 중 **화면이 이미 있고 API 만 꽂으면 되는** 것들입니다.

| 순위 | 엔드포인트 | 지금 FE 상태 | 붙일 자리 |
| --- | --- | --- | --- |
| 1 | `POST /recommendations/natural-language` | 와이어프레임 예시 3건을 고정으로 반환 | `features/recommend/api.ts` `getRecommendation()` 본문만 교체 |
| 2 | `POST /posts` | 저장 버튼에 `TODO` | `pages/PostWritePage.tsx:41` |
| 3 | `POST /posts/{id}/comments` | 댓글 입력창이 아무 일도 안 함 | `pages/PostDetailPage.tsx:198` |
| 4 | `PATCH /comments/{id}` · `DELETE /comments/{id}` | `TODO` | `pages/PostDetailPage.tsx:201,204` |
| 5 | `DELETE /posts/{id}` · `PATCH /posts/{id}` | `TODO` | `pages/PostDetailPage.tsx:103,213` |
| 6 | `PUT·DELETE /posts/{id}/like` | 좋아요 버튼이 서버로 안 감 | `features/community/api.ts` |
| 7 | `PATCH /users/me/nickname` | "엔드포인트가 없다" 는 `TODO` 주석 (**틀린 주석**) | `features/auth/components/AccountForm.tsx:24,94` |
| 8 | `POST·GET /users/me/taste-test` | 테스트 결과를 브라우저에서 계산만 하고 **버립니다** | `features/taste/` |
| 9 | `GET /map/exploration-logs` | 향해 일지가 자리표시자 3건 | `features/map/api.ts` `getVoyageLog()` |
| 10 | `PUT·GET /map/exploration/me` | 미사용 | 3D 엔진과 위치를 주고받을지 먼저 결정 필요 |
| 11 | `GET /map` · `GET /map/perfumes/{id}` | 3D 엔진이 정적 CSV/JSON 사용 | 엔진 데이터를 서버로 옮길지 결정 필요 |
| 12 | `POST /perfume-views` · `PATCH /perfume-views/{id}/exit` | 미사용 | 상세 진입·이탈 기록. 화면 변화 없음 |

가장 아까운 건 **1번**입니다. `ai/server.py` 의 `/nlr/understand` · `/nlr/recommend` 와
백엔드 `NaturalLanguageRecommendationController` 가 이미 다 붙어 있고, 호출량 제한 · 429 · 503 ·
결과 0건 `status` 4종까지 준비돼 있는데 FE 만 고정 예시를 그립니다.

---

## 3. 양쪽 다 없는 것 — 붙이려면 백엔드 작업이 먼저

| 기능 | 화면 | 없는 것 |
| --- | --- | --- |
| 비밀번호 재설정 (A31) | `PasswordResetForm.tsx:26,71` | 메일 발송 · 재설정 엔드포인트 |
| 파일 업로드 전부 | 프로필 이미지(A29) · 게시글 이미지 | `MultipartFile` 을 받는 컨트롤러가 **백엔드 어디에도 없음**. S3 · presigned 흔적도 없음 |
| 개인화 추천 (REC-12·13) | 진열대 추천 카드 | `GET /recommendations/personal` 같은 경로 없음 |
| 커뮤니티 인기 향수 | 커뮤니티 사이드 | "최근 한 주 글에 언급된 수" 를 세는 API 없음 (검색의 `ranking` 은 다른 값이라 대체 불가) |
| 향 이미지 생성 | README 의 주요 기능 | 백엔드·AI 서버 **양쪽 다 엔드포인트 없음** |
| 컬렉션 카드 미리보기 썸네일 | 컬렉션 카드 | 목록 응답에 `previewThumbnails` 없어 빈 상자 3개 고정 |

> **진열대 · 컬렉션 내 검색은 이 표에 있었는데 뺐습니다 — 백엔드 일이 아니라 FE 일이었고, 고쳤습니다.**
> 목록 API 에 검색어 파라미터가 없는 건 맞지만, 그전에 화면이 이미 진열대를 **분류 3개 × 전 페이지
> 통째로** 받아 둡니다(`features/shelf/api.ts` 의 `getShelfItems()`). 그래서 받아 둔 배열 안에서
> 거르면 되고, 진열대 화면의 검색(`useShelfBrowser`)이 원래 그렇게 동작하고 있었습니다.
> 비어 있던 건 컬렉션 만들기 · 담기 **모달 안의 검색창 두 개**뿐이라
> `features/collection/components/ShelfItemPickList.tsx` 에 같은 기준(향수명 · 브랜드)의 필터를
> 넣어 채웠습니다.
>
> 서버 검색이 필요해지는 건 **한 사람의 진열대가 수백 개를 넘어 전부 받는 것이 부담이 될 때**입니다.
> 그때 `GET /users/me/shelf-items` 에 `keyword` 를 요청하세요. 다만 서버 검색 없이 페이지네이션만
> 되살리면 "2페이지에 있던 결과가 안 보이는" 버그가 되니, 둘은 같이 가야 합니다.

---

## 4. 붙었지만 반쪽인 것

- **`withDevFallback`** — `features/perfume/api.ts` 의 읽기 7종은 개발 환경에서 요청이 실패하면
  자리표시자로 덮습니다. 운영에서는 끼어들지 않지만, 로컬에서 "붙은 것처럼 보이는" 착시를 만듭니다.
  붙었는지 확인할 때는 네트워크 탭을 보세요.
- **노트별 향수는 지금 어느 노트든 0건입니다.** API 연결 문제가 아니라 **로컬 DB 의
  `perfume_notes` 연결이 비어 있어서**입니다 — 향수 상세의 향조(`GET /perfumes/{id}/notes`)도
  같은 이유로 전부 빈 배열입니다(accords 는 옵니다). 데이터가 적재되면 화면은 그대로 동작합니다.
- **비는 필드** — `nameKo` · `imageUrl` · `scentFamily` · `logoUrl` 은 null 로 옵니다.
  타입이 필수라고 믿고 접근하면 화면이 죽습니다.
- **좌표 스케일** — 백엔드는 0~1 (`y` 는 0~0.83056), 화면은 0~100. `features/taste/api.ts` 가
  100배 합니다. `GET /map` 을 붙일 때 같은 변환이 필요합니다.

---

## 5. 지금 코드에 남아 있는 틀린 주석

붙이기 전에 같이 지워야 할 것들입니다.

| 위치 | 뭐라고 쓰여 있나 | 사실 |
| --- | --- | --- |
| `features/recommend/api.ts:5` | "백엔드 · AI 추천 API 가 아직 없습니다" | `POST /recommendations/natural-language` 가 있습니다 |
| `features/auth/components/AccountForm.tsx:24` | "`PATCH /users/me` 같은 수정 경로가 없습니다" | `PATCH /users/me/nickname` 이 있습니다 (프로필 이미지는 여전히 없음) |
| `features/map/api.ts:4` | "백엔드 향 지도 API 가 아직 없습니다" | `GET /map` · `/map/perfumes/{id}` · 탐색 기록 3종이 있습니다 |
| `CLAUDE.md` "백엔드가 아직 없는 엔드포인트" | 닉네임 수정이 없다고 적혀 있음 | 위와 같습니다. 이 문단도 갱신이 필요합니다 |
