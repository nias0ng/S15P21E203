# 테스트 커버리지 점검 가이드

이 문서는 백엔드 테스트가 어느 코드를 실제로 실행했는지 JaCoCo로 측정하고 읽는 방법을 설명합니다.
커버리지는 테스트가 **거쳐 간 코드**를 알려줄 뿐 테스트가 올바른 것을 검증했는지는 알려주지 않습니다.
수치를 목표로 삼지 않고, 손대지 않은 코드를 찾는 데 씁니다.

이 문서의 모든 상대 경로는 `backend/`를 기준으로 합니다.

## 1. 측정 도구

`build.gradle`의 `jacoco` 플러그인이 `test` 태스크를 계측합니다. 별도 설치는 필요하지 않습니다.

```groovy
plugins {
    id 'java'
    id 'jacoco'
    ...
}

tasks.named('test') {
    useJUnitPlatform()
    finalizedBy tasks.named('jacocoTestReport')
}

jacoco {
    toolVersion = '0.8.12'
}

tasks.named('jacocoTestReport') {
    dependsOn tasks.named('test')

    classDirectories.setFrom(files(classDirectories.files.collect { dir ->
        fileTree(dir) { exclude '**/entity/*Id.class' }
    }))

    reports {
        html.required = true
        xml.required = true
    }
}
```

설정에서 정한 것은 세 가지입니다.

**`test`를 `finalizedBy`로 묶습니다.** 팀 표준 명령이 `./gradlew test`이므로 리포트 태스크를
따로 부르지 않아도 결과가 나오게 합니다. `finalizedBy`라서 테스트가 실패해도 그때까지의 리포트는
남습니다. 실패를 조사할 때 오히려 그 리포트가 필요합니다.

**JPA 복합키를 리포트에서 뺍니다.** 자세한 이유는 4장에 적었습니다.

**임계값(`violationRules`)은 걸지 않습니다.** 기준선을 먼저 쌓아 도메인별 목표를 정한 뒤에
논의합니다. 처음부터 임계값을 걸면 빌드가 곧바로 실패해 `-x test`로 우회하는 습관만 남습니다.

## 2. 실행

통합 테스트가 Testcontainers를 쓰므로 **Docker Desktop이 실행 중이어야 합니다.** 수동 테스트용
Compose를 미리 띄울 필요는 없습니다.

```bash
./gradlew test
```

리포트 태스크가 `test`에 묶여 있어 따로 부르지 않아도 됩니다. 테스트를 건너뛰고 직전 실행
결과로 리포트만 다시 만들려면 `./gradlew jacocoTestReport -x test`를 씁니다. 다만 그사이
IDE가 클래스를 다시 빌드했다면 실행 데이터와 어긋나므로, 수치를 기록할 때는 쓰지 않습니다.

전체 실행에는 7분 내외가 걸립니다. 결과는 다음 두 곳에 생깁니다.

| 경로 | 용도 |
| --- | --- |
| `build/reports/jacoco/test/html/index.html` | 사람이 읽는 리포트. 클래스·라인 단위까지 내려감 |
| `build/reports/jacoco/test/jacocoTestReport.xml` | 도구가 읽는 리포트. 도메인별 집계와 CI 연동에 씀 |

`build/`는 `.gitignore`에 있으므로 리포트가 저장소에 들어가지 않습니다.

## 3. 도메인별로 읽기

JaCoCo는 패키지 단위로만 집계합니다. 한 도메인이 `controller`·`service`·`repository`처럼
하위 패키지 여러 개로 나뉘어 있어 **도메인 전체 수치는 직접 합쳐야 합니다.**

| 영역 | 패키지 |
| --- | --- |
| 향수 | `com.hyanghae.backend.perfume` |
| 향 지도 | `com.hyanghae.backend.map` |
| 커뮤니티 | `com.hyanghae.backend.community` |
| AI 추천 | `com.hyanghae.backend.recommendation` |

XML에서 합치려면 다음 스크립트를 씁니다. `backend/`에서 실행합니다.

```python
import sys
import xml.etree.ElementTree as ET

DOMAINS = [
    ("향수", "com/hyanghae/backend/perfume"),
    ("향 지도", "com/hyanghae/backend/map"),
    ("커뮤니티", "com/hyanghae/backend/community"),
    ("AI 추천", "com/hyanghae/backend/recommendation"),
]

root = ET.parse("build/reports/jacoco/test/jacocoTestReport.xml").getroot()

for label, prefix in DOMAINS:
    acc = {}
    for package in root.findall("package"):
        name = package.get("name")
        # perfume 과 perfumeview 가 섞이지 않도록 경계를 확인합니다.
        if name != prefix and not name.startswith(prefix + "/"):
            continue
        for counter in package.findall("counter"):
            missed, covered = acc.get(counter.get("type"), (0, 0))
            acc[counter.get("type")] = (
                missed + int(counter.get("missed")),
                covered + int(counter.get("covered")),
            )
    for metric in ("LINE", "BRANCH"):
        missed, covered = acc.get(metric, (0, 0))
        total = missed + covered
        rate = 100 * covered / total if total else 0
        print(f"{label:<8} {metric:<7} {rate:5.1f}% ({covered}/{total})")
```

특정 도메인만 빠르게 보려면 테스트를 걸러 실행할 수 있습니다.

```bash
./gradlew test --tests "com.hyanghae.backend.community.*" jacocoTestReport
```

다만 이렇게 하면 **나머지 도메인이 0%로 찍히므로 해당 패키지 수치만 읽어야 합니다.**
전체 수치를 기록할 때는 반드시 필터 없이 실행합니다.

## 4. 수치를 읽을 때 주의할 점

### 라인보다 분기를 봅니다

통합 테스트는 정상 경로 한 번으로 서비스 전체를 훑고 지나가므로 라인 커버리지는 쉽게 높아집니다.
**실패·경계 사례를 검증했는지는 분기(BRANCH) 커버리지에 드러납니다.** 두 수치가 크게 벌어진
도메인이 곧 "정상 경로만 본 도메인"입니다.

### JPA 복합키는 리포트에서 빠져 있습니다

복합키 클래스(`PerfumeNoteId`, `PostLikeId` 등)의 `equals`/`hashCode`는 영속성 컨텍스트가
내부적으로만 호출하므로 테스트에서 직접 실행될 일이 없습니다. `Objects.equals` 하나가 분기
4개로 잡혀 **향수 도메인 분기 커버리지를 25%p 넘게 끌어내렸습니다.** 손댈 곳을 가리는 숫자가
되도록 1장의 설정이 리포트에서 뺍니다.

현재 빠지는 클래스는 아홉 개입니다.

```text
collection/entity/CollectionPerfumeId    perfume/entity/PerfumeNeighborId
community/entity/PostLikeId              perfume/entity/PerfumeNoteId
community/entity/PostPerfumeId           perfume/entity/PerfumeReviewKeywordId
perfume/entity/PerfumeAccordId           review/entity/PerfumeReviewSeasonId
                                         review/entity/ReviewLikeId
```

**제외 규칙은 이름에 기대고 있습니다** — `entity` 패키지 안에서 `Id`로 끝나는 클래스를
거릅니다. 복합키를 다른 이름으로 만들면 리포트에 그대로 남고, 반대로 `entity` 패키지에 `Id`로
끝나는 일반 클래스를 만들면 잘못 빠집니다. 복합키를 추가할 때는 이름을 `엔티티명 + Id`로
맞춥니다.

### 건너뛴 테스트는 수치에 반영되지 않습니다

`RealS3ConnectivityTest`는 실제 AWS 자격증명이 있어야 실행되므로 평소에는 건너뜁니다.
따라서 `global.storage` 수치는 실제보다 낮게 잡힙니다.

### 측정 시점의 커밋을 함께 기록합니다

커버리지는 코드가 바뀌면 곧바로 의미를 잃습니다. 수치를 공유할 때는 어느 커밋에서 측정했는지
반드시 함께 적습니다.

## 5. 자주 겪는 문제

### `Unable to delete directory ... test-results\test\binary`

이전 Gradle 데몬이 결과 파일을 잡고 있어서 생깁니다. Windows에서 자주 납니다.

```bash
./gradlew --stop
```

데몬을 내린 뒤 다시 실행합니다. IntelliJ에서 테스트를 돌린 직후라면 특히 자주 발생합니다.

### 모든 테스트 클래스가 `ClassNotFoundException`으로 실패

저장소 경로에 한글 등 비ASCII 문자가 있으면 Gradle 테스트 워커가 클래스를 찾지 못합니다.
컴파일은 성공하는데 실행만 실패하고 증상이 전 클래스에 걸쳐 같다면 저장소를 `C:\dev\S15P21E203`
같은 ASCII 경로로 옮깁니다.

### 통합 테스트가 컨테이너를 기다리다 실패

Docker Desktop이 떠 있는지 확인합니다. 처음 실행하면 PostgreSQL·Redis·LocalStack 이미지를
내려받느라 오래 걸릴 수 있습니다.

## 6. 기준선 (2026-09-21)

커밋 `d8c4349` 기준입니다. 임계값을 정하기 전에 현재 위치를 기록해 둔 값이며 목표치가 아닙니다.

```text
테스트 803개 / 실패 0 / 건너뜀 3 / 클래스 92개 / 6분 28초
```

### 도메인별

1장의 설정이 JPA 복합키를 이미 뺐으므로 아래는 리포트에 그대로 찍히는 수치입니다.

| 영역 | 라인 | 분기 | 메서드 |
| --- | --- | --- | --- |
| 향수 | 97.4% (520/534) | 90.2% (74/82) | 97.7% (171/175) |
| 향 지도 | 98.6% (273/277) | 92.6% (50/54) | 100.0% (92/92) |
| 커뮤니티 | 97.7% (462/473) | 84.2% (123/146) | 97.5% (156/160) |
| AI 추천 | 95.0% (422/444) | 84.1% (95/113) | 97.3% (109/112) |
| 저장소 전체 | 95.5% (3392/3552) | 80.4% (638/794) | 96.5% (1059/1097) |

### 읽은 결과

**네 영역 모두 라인은 95% 이상입니다.** 통합 테스트가 각 도메인의 정상 경로를 두텁게 덮고
있습니다. 도메인 사이의 의미 있는 차이는 라인이 아니라 분기에 있습니다.

**향 지도가 가장 촘촘하고(분기 92.6%), 커뮤니티와 AI 추천이 가장 성깁니다(84%대).**
커뮤니티는 라인 97.7%와 분기 84.2%의 간격이 13%p로 네 영역 중 가장 넓습니다. 정상 경로는
빠짐없이 지나가지만 조건 분기의 반대편을 덜 본다는 뜻입니다.

**단위 테스트 파일의 유무는 커버리지와 이어지지 않았습니다.** 커뮤니티는 `service` 단위 테스트가
하나도 없는데도 통합 테스트만으로 라인 97.7%를 채웠습니다. 파일 목록으로 빈 곳을 추정하지 않고
측정값을 봐야 하는 이유입니다.

### 남은 공백

미검증 분기가 많은 순입니다.

| 영역 | 클래스 | 미검증 분기 | 미실행 라인 |
| --- | --- | --- | --- |
| 커뮤니티 | `dto/request/PostUpdateRequest` | 10 / 48 | 1 |
| AI 추천 | `service/NaturalLanguageRecommendationService` | 9 / 48 | 6 |
| 커뮤니티 | `service/PostService` | 4 / 58 | 2 |
| 향수 | `client/GmsReviewAnalyzer` | 3 / 10 | 2 |
| 향수 | `client/GmsChatResponse` | 3 / 8 | 1 |
| 커뮤니티 | `dto/request/PostCreateRequest` | 3 / 6 | — |
| AI 추천 | `service/PersonalizedRecommendationService` | 2 / 7 | 3 |
| 향 지도 | `service/ExplorationService` | 2 / 26 | 1 |
| 커뮤니티 | `config/PostImageWebConfig` | 2 / 4 | 1 |
| AI 추천 | `client/NlrClient` | 1 / 4 | 4 |
| AI 추천 | `batch/NlrRetentionScheduler` | — | 6 |

공백은 크게 세 갈래입니다.

- **외부 응답이 계약을 어겼을 때의 방어 경로.** `GmsReviewAnalyzer`·`GmsChatResponse`는 LLM이,
  `NaturalLanguageRecommendationService`와 `NlrClient`는 AI 서버가 예상 밖 응답을 줬을 때의
  처리입니다. 상대가 계약을 지키는 동안에는 실행되지 않으므로, 정작 계약이 깨졌을 때 처음
  돌아갑니다.
- **부분 수정 요청의 조합.** `PostUpdateRequest`의 `isValidPatch()`는 "보내지 않음"과
  "비우라고 보냄"을 가르는 규칙이라 조합이 많습니다. 외부 의존이 없는 순수 함수여서
  단위 테스트로 가장 싸게 메울 수 있는 자리입니다.
- **스케줄러와 트랜잭션 이후 동작.** `NlrRetentionScheduler`와 `PostService`의 커밋 후 이미지
  정리는 실행 시점이 요청 밖이라 통합 테스트가 닿지 않습니다.

정확한 라인 위치는 코드가 바뀌면 곧 어긋나므로 이 문서에 적지 않습니다.
`build/reports/jacoco/test/html/index.html`에서 클래스를 열면 미실행 라인이 붉게 표시됩니다.
