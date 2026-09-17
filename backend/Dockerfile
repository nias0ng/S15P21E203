FROM eclipse-temurin:21-jdk-jammy AS builder

WORKDIR /workspace

COPY . .

RUN set -eu; \
    test -f ./gradlew; \
    sed -i 's/\r$//' ./gradlew; \
    chmod +x ./gradlew; \
    ./gradlew clean bootJar --no-daemon; \
    JAR_PATH="$(find build/libs -maxdepth 1 -type f -name '*.jar' ! -name '*-plain.jar' -print -quit)"; \
    test -n "$JAR_PATH"; \
    cp "$JAR_PATH" /workspace/app.jar

FROM eclipse-temurin:21-jre-jammy

WORKDIR /app

RUN groupadd --system spring \
    && useradd --system --gid spring --no-create-home spring

# 올라온 이미지를 쌓는 곳입니다. 게시글 이미지와 프로필 사진이 이 아래의 서로 다른 하위
# 디렉터리를 씁니다. WORKDIR 은 root 소유라 여기서 만들어 주지 않으면 spring 사용자가 쓰지
# 못해 애플리케이션이 시작할 때 실패합니다. 하위 디렉터리는 시작할 때 만들어집니다.
#
# ⚠ 이미지 안의 디렉터리입니다. 컨테이너를 다시 만들면 내용이 사라지므로 배포에서는 반드시
# 볼륨을 붙여야 합니다. 자세한 내용은 docs/image-upload.md 를 보십시오.
RUN mkdir -p /app/uploads \
    && chown spring:spring /app/uploads

COPY --from=builder --chown=spring:spring /workspace/app.jar /app/app.jar

USER spring:spring

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "/app/app.jar"]
