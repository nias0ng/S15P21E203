# 자연어 향수 추천 AI 서버
#
#   docker build --tag hyanghae-ai:latest ai
#   docker run --rm -p 8000:8000 hyanghae-ai:latest
#
# 빌드 단계가 없습니다. 컴파일할 것이 없고 데이터가 저장소에 들어 있어서
# `pip install` 과 파일 복사가 전부입니다. backend/Dockerfile 처럼 builder 단계를
# 두지 않은 이유입니다.
#
# 포트·환경변수·볼륨·아웃바운드 같은 배포 조건은 인프라 담당에게 따로 인계했습니다.
# 이 서버는 외부에 열지 않습니다 — 인증과 호출량 제한은 Spring 이 합니다.

FROM python:3.11-slim

# PYTHONUNBUFFERED  로그를 버퍼에 담아두지 않습니다. `docker logs` 가 바로 보여야 합니다
# PYTHONIOENCODING  이 서버의 로그는 한국어입니다. 컨테이너에 LANG 이 없을 때를 대비합니다
# PYTHONDONTWRITEBYTECODE  비특권 사용자로 돌므로 .pyc 를 쓰려다 실패할 일을 만들지 않습니다
ENV PYTHONUNBUFFERED=1 \
    PYTHONIOENCODING=UTF-8 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

# 의존성을 코드보다 먼저 깝니다. 코드만 고쳤을 때 이 층이 캐시에 남아 빌드가 빨라집니다.
# pandas · numpy 는 휠로 설치되므로 컴파일러가 필요 없습니다.
COPY requirements.txt ./
RUN pip install --no-cache-dir --requirement requirements.txt

# 비특권 사용자. backend/Dockerfile 과 같은 방식입니다.
RUN groupadd --system nlr \
    && useradd --system --gid nlr --no-create-home nlr

COPY --chown=nlr:nlr . .

# 미매칭 로그를 쓸 자리를 미리 만들고 소유자를 맞춥니다.
#
# ⚠ 비특권 사용자로 돌기 때문에 **볼륨 소유자가 안 맞으면 로그를 못 씁니다.**
#   미매칭 로그는 사전이 못 받은 표현을 남기는 곳이고, 사전을 키울 유일한 단서입니다.
#
#   named volume 을 붙이면  -> Docker 가 이 디렉터리의 소유자를 볼륨에 복사해 줍니다. 그대로 됩니다
#   bind mount 를 붙이면    -> **호스트 디렉터리 소유자를 컨테이너의 nlr 과 맞춰야 합니다**
RUN mkdir -p /app/logs && chown nlr:nlr /app/logs

USER nlr:nlr

EXPOSE 8000

# curl 을 설치하지 않으려고 파이썬으로 확인합니다. 이미지에 패키지를 더하지 않습니다.
# start-period 20초는 실측 기동 시간 2.4초(Windows)에 여유를 둔 값입니다.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD ["python", "-c", "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=3).status == 200 else 1)"]

# ENTRYPOINT 가 아니라 CMD 입니다. compose 에서 인자를 통째로 덮어쓸 수 있게 둡니다.
#
# ⚠ `--workers N` 을 붙이면 메모리가 그 배수로 늘어납니다. 워커마다 129,161 x 92 행렬
#   (약 162MB)을 따로 만듭니다. 요청 시간의 대부분은 GMS 응답을 기다리는 시간이라
#   워커를 늘려도 얻는 것이 적습니다. **1개로 시작하십시오.**
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8000"]
