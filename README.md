# 🌿 향을 탐색하고, 발견하고, 기록하는 향수 추천 서비스

사용자가 원하는 향을 자연어로 표현하면 향수 데이터를 기반으로 취향에 맞는 향수를 탐색하고 추천받을 수 있는 서비스입니다.

단순히 향수를 검색하는 것을 넘어, **향 지도 탐색 · AI 향수 추천 · 개인 취향 관리 · 커뮤니티 공유**를 통해 사용자가 자신의 향 취향을 발견하고 기록할 수 있도록 합니다.

| | |
|---|---|
| 처음 실행 | [로컬 개발 환경 빠른 시작](docs/local-development-guide.md) |
| 빌드·배포 | [exec/01_빌드_및_배포.md](exec/01_빌드_및_배포.md) |
| 외부 서비스 | [exec/02_외부_서비스.md](exec/02_외부_서비스.md) |

---

## ✨ 주요 기능

### 🗺️ 향 지도 탐색

향수를 향 특성에 따라 배치한 3D 지도를 탐색합니다. three.js 로 직접 그린 자체 화면입니다.

- 향 계열별 향수 탐색
- 지도에서 관심 있는 향수 확인
- 비슷한 특징을 가진 향수 발견

### 🤖 AI 향수 추천

원하는 분위기와 향의 느낌을 자연어로 입력하면 적합한 향수를 추천합니다.

> "빨래 냄새 나는 향수 찾고 있어"
> "가을에 쓸 남성적인 우드향 추천해줘"

**추천한 이유를 함께 보여줍니다.** 입력한 표현이 어떤 향 특성을 가리켰고, 그 향수가
그 특성을 얼마나 가졌는지를 근거로 남깁니다.

### 🧪 취향 테스트 · 개인화 추천

취향 테스트 결과와 최근 본 향수를 함께 보고 개인화 추천을 제공합니다.

### 🧺 진열대 · 컬렉션

관심 있는 향수를 진열대에 모으고 컬렉션으로 묶어 관리합니다.

### 💬 향 커뮤니티

향에 대한 경험과 감상을 다른 사용자와 공유합니다.

- 후기 게시판 · 자유 게시판
- 향수 평가 및 후기 작성
- 댓글 · 좋아요

---

## 🔄 서비스 이용 흐름

```text
향 지도 탐색
      ↓
관심 있는 향 발견
      ↓
향수 상세 정보 확인
      ↓
AI 향수 추천
      ↓
진열대에 저장 · 컬렉션 구성
      ↓
후기 작성 및 커뮤니티 공유
```

사용자는 특정 향수를 구매하기 위한 목적뿐만 아니라, 다양한 향을 탐색하고 자신의 취향을 발견하기 위해 서비스를 이용할 수 있습니다.

---

## 🛠️ Tech Stack

### Frontend

| 분류 | 사용 기술 |
|---|---|
| 언어 | TypeScript 6.0 |
| 프레임워크 | React 19.2 |
| 빌드 | Vite 8.2 · Node.js 22.12+ · npm 10.9+ |
| 라우팅 | react-router 8.3 |
| 서버 상태 | TanStack Query 5.102 |
| 전역 상태 | Zustand 5.0 |
| 스타일 | Tailwind CSS 4.3 |
| 3D | three.js 0.160 |
| HTTP | axios 1.20 |
| 테스트 | Vitest 5.0 · Testing Library · jsdom |
| 품질 | ESLint 10.9 · Prettier 3.9 |

### Backend

| 분류 | 사용 기술 |
|---|---|
| 언어 | Java 21 |
| 프레임워크 | Spring Boot 3.5.16 |
| 빌드 | Gradle 8.14.3 (Wrapper) |
| WAS | 내장 Tomcat (포트 8080) |
| 보안 | Spring Security · JWT (자체 발급) |
| 데이터 | Spring Data JPA · Spring Data Redis |
| 마이그레이션 | Flyway (V1~V26) |
| API 문서 | springdoc-openapi 2.9 (Swagger UI) |
| 스토리지 | AWS SDK v2 (S3) |
| 모니터링 | Actuator · Micrometer · Prometheus |
| 테스트 | JUnit 5 · Testcontainers · JaCoCo |

### AI / Data

| 분류 | 사용 기술 |
|---|---|
| 언어 | Python 3.11 |
| 서버 | FastAPI · uvicorn (포트 8000) |
| 데이터 | pandas · numpy |
| LLM | SSAFY GMS (OpenAI 호환 게이트웨이) |
| 데이터 원천 | Fragrantica 기반 향수 129,161건 · 향 특성 92종 |
| 자체 구축 | 한국어 향 사전 · 노트-어코드 연결표 · 한국어 노트 별칭 |

### Database · Infra

| 분류 | 사용 기술 |
|---|---|
| DB | PostgreSQL 17 |
| 캐시 | Redis 7.4 |
| 컨테이너 | Docker · Docker Compose |
| CI/CD | Jenkins |
| 스토리지·CDN | AWS S3 · CloudFront |
| 웹서버 | nginx (정적 서빙 + 리버스 프록시) |
| 부하 테스트 | k6 |

---

## 🏗️ 시스템 구성

```text
                  브라우저
                     │
                     ▼
              nginx (정적 + 리버스 프록시)
              ├── /            → /var/www/hyanghae  (프론트 빌드 산출물)
              └── /api/v1/...  → backend :8081 → :8080
                                      │
                        ┌─────────────┼─────────────┐
                        ▼             ▼             ▼
                  PostgreSQL 17    Redis 7.4    AI 서버 :8000
                                                 (외부 비공개)
                                                       │
                                                       ▼
                                                 SSAFY GMS (LLM)
```

---

## 📁 저장소 구조

```text
backend/        Spring Boot API 서버 · Flyway 마이그레이션 · 시드 스크립트
frontend/       React 앱 (main) + 3D 향 지도 엔진 (landing)
ai/             자연어 추천 엔진 · FastAPI 서버
docs/           팀 문서 · 로컬 개발 가이드 · 요구사항·기능 명세
exec/           빌드·배포 · 외부 서비스 · DB 덤프 · 시연 시나리오 (제출물)
performance/    k6 부하 테스트 시나리오
TIL/            팀원 학습 기록
```

---

## 🚀 빠른 시작

```bash
git clone <저장소 주소>
cd S15P21E203
cp .env.example .env
```

`.env` 값을 채운 뒤

```bash
docker compose -f compose.manual-test.yaml up -d --build --wait
docker compose -f compose.manual-test.yaml run --rm seed
```

프론트엔드는 따로 띄웁니다.

```bash
cd frontend
cp .env.example .env.local
npm ci
npm run dev
```

| 주소 | 내용 |
|---|---|
| http://localhost:5173 | 프론트엔드 |
| http://localhost:8080/actuator/health | 백엔드 상태 |
| http://localhost:8080/swagger-ui/index.html | API 문서 (`manual-test` 프로필) |

자세한 절차는 [로컬 개발 환경 가이드](docs/local-development-guide.md)에 있습니다.

---

## 👥 Team

| 이름 | 역할 |
|---|---|
| 김용석 | 팀장, AI |
| 김재성 | 디자인, AI |
| 권영민 | BE, DB |
| 김경린 | Infra, BE, DB |
| 송가연 | DB, FE |
| 차서영 | PM, FE |
