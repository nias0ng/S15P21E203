# 사용자 업로드 이미지 S3 전환

지금 사용자 업로드 이미지(게시글 이미지 · 프로필 사진)는 **서버 로컬 디스크**에 쌓고 백엔드가
직접 내줍니다. 카탈로그 이미지(노트 · 향수)가 이미 S3 + CloudFront 를 쓰고 있으므로 같은
경로로 합치려 합니다.

**인프라 값을 받아 반영을 마쳤습니다.** 아래 §0 의 네 줄을 배포 디렉터리의 `.env` 에 넣으면
코드 배포 없이 켜집니다. §2 는 인프라 쪽에 요청했던 내용이고 기록으로 남깁니다.

## 0. 받은 값과 켜는 방법

| 항목 | 값 |
| --- | --- |
| 버킷 | `hyanghae-images-prod-s15p21e203` |
| 리전 | `ap-northeast-2` |
| CloudFront | `https://djpgc0m2v54q1.cloudfront.net` |
| 운영 프리픽스 | `uploads` |
| 개발 프리픽스 | `uploads/dev` |

**운영 서버** `/home/ubuntu/hyanghae/.env`

```
IMAGE_STORAGE_S3_ENABLED=true
IMAGE_STORAGE_S3_BUCKET=hyanghae-images-prod-s15p21e203
IMAGE_STORAGE_S3_REGION=ap-northeast-2
IMAGE_STORAGE_S3_PUBLIC_BASE_URL=https://djpgc0m2v54q1.cloudfront.net
IMAGE_STORAGE_S3_KEY_PREFIX=uploads
```

**개발 서버**는 마지막 줄만 `IMAGE_STORAGE_S3_KEY_PREFIX=uploads/dev` 로 바꿉니다.

자격 증명은 여기 넣지 않습니다. EC2 인스턴스 역할을 쓰면 아무것도 넣지 않아도 되고, IAM
액세스 키를 쓴다면 `AWS_ACCESS_KEY_ID` 와 `AWS_SECRET_ACCESS_KEY` 를 같은 `.env` 에 넣습니다.
**저장소에는 절대 커밋하지 않습니다.**

### 만들어지는 경로

```
운영   uploads/posts/2026/09/<uuid>.png       → https://djpgc0m2v54q1.cloudfront.net/uploads/posts/2026/09/<uuid>.png
개발   uploads/dev/posts/2026/09/<uuid>.png   → https://djpgc0m2v54q1.cloudfront.net/uploads/dev/posts/2026/09/<uuid>.png
```

프로필 사진은 `posts` 자리가 `profiles` 로 바뀝니다.

### `IMAGE_STORAGE_S3_PUBLIC_PATH_PREFIX` 는 넣지 않습니다

CloudFront 배포가 **버킷 뿌리를 서빙**하므로 주소에 프리픽스가 그대로 나와야 합니다. 카탈로그
이미지가 그 증거입니다 — `https://djpgc0m2v54q1.cloudfront.net/perfumes/65738/original.png`
이 200 으로 열리고, 이것은 S3 키 `perfumes/65738/original.png` 와 같습니다. 오리진 경로가
있었다면 주소와 키가 달랐을 것입니다.

배포 설정이 나중에 바뀌어 주소에서 프리픽스를 빼야 하면 그때
`IMAGE_STORAGE_S3_PUBLIC_PATH_PREFIX=-` 를 추가합니다. 안 넣고 바뀌면 주소에 프리픽스가 두 번
들어가 404 가 납니다.

### ⚠ 개발 경로가 운영 경로 안에 있습니다

`uploads/dev` 가 `uploads` 아래에 있습니다. 저장·삭제는 최종 경로가
`uploads/posts/` 와 `uploads/dev/posts/` 로 갈려 서로를 건드리지 못합니다(테스트로 고정).

**다만 나중에 만들 청소 배치는 다릅니다.** 운영에서 `uploads/` 아래를 통째로 훑으면 개발
객체까지 걸립니다. 그 배치를 만들 때 개발 경로를 빼야 합니다.

## 1. 지금과 무엇이 달라지는가

|  | 지금 (로컬 디스크) | 옮긴 뒤 (S3) |
| --- | --- | --- |
| 저장 | EC2 `/app/uploads` | S3 `uploads/` 프리픽스 |
| 전달 | 백엔드 JVM 이 직접 | CloudFront |
| DB 에 들어가는 값 | `/api/v1/posts/images/...` | `https://djpgc0m2v54q1.cloudfront.net/uploads/...` |
| 서버 대수 | 1대 고정 (파일이 그 서버에 있음) | 제한 없음 |
| 배포 시 유실 | 볼륨 없으면 유실 | 없음 |

카탈로그 이미지와 **같은 버킷, 다른 프리픽스**를 씁니다. 버킷과 CloudFront 배포를 새로 만들지
않아도 되고, 권한은 업로드 프리픽스로만 좁힐 수 있습니다.

## 2. 요청 사항

### 2-1. S3 프리픽스

기존 버킷(현재 `notes/`, `perfumes/` 가 있는 그 버킷)에 아래 구조로 쌓습니다. 미리 만들 것은
없습니다 — 객체를 넣으면 생깁니다.

```
uploads/posts/{yyyy}/{MM}/{uuid}.{확장자}
uploads/profiles/{yyyy}/{MM}/{uuid}.{확장자}
```

확장자는 `jpg` · `png` · `gif` · `webp` 넷뿐이고, 파일 이름은 백엔드가 UUID 로 짓습니다.

### 2-2. 백엔드에 줄 쓰기 권한

백엔드가 S3 에 **쓰고 지울** 수 있어야 합니다. 지금은 CloudFront 만 읽을 수 있게 잠겨 있으니
그 구조는 그대로 두고, 백엔드용 권한을 따로 만들어 주세요.

* 대상: `arn:aws:s3:::{버킷}/uploads/*` — **`uploads/` 아래로만 좁혀 주세요.** 넓게 주면
  권한 사고가 카탈로그 이미지까지 번집니다.
* 필요한 동작: `s3:PutObject`, `s3:DeleteObject`
* `s3:GetObject` 는 필요 없습니다. 읽기는 CloudFront 가 합니다.
* `s3:ListBucket` 도 필요 없습니다.

**전달 방식**은 둘 중 편한 쪽으로 정해 주세요.

1. **EC2 인스턴스 역할** (권장) — 키 파일이 서버에 없어 유출 위험이 없고 만료 관리도 필요
   없습니다. 백엔드는 설정 없이 그대로 씁니다.
2. **IAM 사용자 액세스 키** — 배포 디렉터리의 `.env` 에 넣어 주세요. 저장소에는 절대 커밋하지
   않습니다.

   ```
   AWS_ACCESS_KEY_ID=...
   AWS_SECRET_ACCESS_KEY=...
   ```

### 2-3. CloudFront 비헤이비어

`uploads/*` 경로가 같은 배포(`djpgc0m2v54q1.cloudfront.net`)에서 나가야 합니다.

* 경로 패턴: `uploads/*`
* 오리진: 카탈로그와 같은 S3 오리진
* 뷰어 프로토콜: HTTPS only
* 허용 메서드: `GET, HEAD` — **`PUT`/`POST` 는 열지 마세요.** 업로드는 백엔드가 S3 에 직접
  하고 CloudFront 를 거치지 않습니다.
* 캐시: 오래 잡아도 됩니다(30일 이상). 파일 이름이 UUID 라 **같은 주소의 내용이 바뀌지
  않습니다.** 사진을 바꾸면 새 주소가 나오므로 무효화(invalidation)도 필요 없습니다.

### 2-4. 버킷 리전과 이름

백엔드 설정에 넣어야 합니다. 알려 주세요.

* 버킷 이름: `________`
* 리전: `________` (예: `ap-northeast-2`)

## 3. 백엔드가 맞춰 넣을 것 (참고)

인프라 작업이 끝나면 백엔드에서 처리합니다. 요청 사항은 아니고, 왜 위의 항목들이 필요한지
보이도록 적어 둡니다.

* **객체마다 `Content-Type` 을 명시적으로 넣습니다.** S3 는 확장자로 타입을 추론하지 않습니다.
  안 넣으면 CloudFront 가 `binary/octet-stream` 으로 내려 브라우저가 이미지를 렌더링하지
  않고 다운로드합니다.
* **`Cache-Control` 도 객체에 넣습니다.** CloudFront 설정과 별개로 브라우저 캐시를 위해
  필요합니다.
* 업로드 객체는 **비공개**로 둡니다. 공개 ACL 을 쓰지 않습니다 — 읽기는 CloudFront 만
  합니다.
* DB 에는 CloudFront 절대 URL 이 들어갑니다. 카탈로그 이미지와 같은 형태라 프론트엔드가
  주소 형태를 하나로 다룰 수 있게 됩니다.

## 4. 백엔드 쪽은 준비돼 있습니다

**코드 배포 없이 설정만으로 켜집니다.** 저장소 구현은 이미 들어가 있고, LocalStack 으로 실제
S3 API 위에서 검증했습니다(키 배치 · `Content-Type` · 삭제 · 남의 주소 무시).

인프라 작업이 끝나면 배포 디렉터리(`/home/ubuntu/hyanghae`)의 `.env` 에 네 줄을 넣고 평소처럼
배포하면 됩니다.

```
IMAGE_STORAGE_S3_ENABLED=true
IMAGE_STORAGE_S3_BUCKET=<버킷 이름>
IMAGE_STORAGE_S3_REGION=<리전>
IMAGE_STORAGE_S3_PUBLIC_BASE_URL=https://djpgc0m2v54q1.cloudfront.net
```

IAM 액세스 키 방식이라면 `AWS_ACCESS_KEY_ID` 와 `AWS_SECRET_ACCESS_KEY` 도 같은 파일에
넣습니다. EC2 인스턴스 역할이면 넣을 것이 없습니다.

**켜기 전에 확인할 것 둘**

* 네 값 중 하나라도 비어 있으면 **애플리케이션이 시작되지 않습니다.** 첫 업로드에서 500 을
  보고 알아채는 것보다 배포 시점에 실패하는 편이 낫다고 보아 그렇게 두었습니다.
* `IMAGE_STORAGE_S3_PUBLIC_BASE_URL` 은 **CloudFront 주소**입니다. S3 객체 주소를 넣으면
  버킷이 CloudFront 만 읽도록 잠겨 있어 사용자가 403 을 받습니다.

## 5. 전환 순서

1. 인프라 작업(§2) 완료 → 버킷 이름 · 리전 · 권한 전달 방식 회신
2. `.env` 에 §4 의 값 추가 후 배포
3. 업로드 한 번 해 보고 CloudFront 주소로 이미지가 내려오는지 확인
4. 전환 후 `compose.yaml` 의 `/app/uploads` 볼륨은 제거해도 됩니다

**⚠ 이미 운영에서 업로드를 받은 뒤라면 3번 앞에 파일 이전이 들어갑니다.** 로컬 디스크의
파일을 S3 로 올리고 DB 에 저장된 `/api/v1/...` 주소도 함께 바꿔야 합니다. 전환 뒤에는 그
주소를 내주는 핸들러가 등록되지 않아 옛 이미지가 닿지 않습니다. **업로드 기능이 운영에
나가기 전에 전환을 끝내면 이 작업이 통째로 없어집니다.**

## 6. 전환 전까지

서버 디스크 방식이 그대로 동작합니다(기본값). 그 상태로 배포한다면 `image-upload.md` §5 의
볼륨 작업이 필요합니다. 전환이 먼저 끝나면 그 작업은 건너뛰어도 됩니다.

## 7. 참고 문서

- [이미지 업로드 가이드](image-upload.md)
- [백엔드 개발 가이드라인](backend-development-guidelines.md)
