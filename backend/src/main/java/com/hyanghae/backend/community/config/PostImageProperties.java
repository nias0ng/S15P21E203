package com.hyanghae.backend.community.config;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.nio.file.Path;
import java.nio.file.Paths;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;
import org.springframework.util.unit.DataSize;
import org.springframework.validation.annotation.Validated;

/**
 * 게시글 이미지 업로드 설정입니다.
 *
 * <p>기본값을 yaml 이 아니라 여기에 둡니다. 프로필이 세 개라 yaml 에 두면 같은 값을 세 곳에
 * 적게 되고, 한 곳을 빼먹으면 그 프로필만 다르게 동작합니다. yaml 은 바꿀 값만 적습니다.
 *
 * @param directory 파일을 쌓을 디렉터리입니다. 상대 경로면 프로세스의 작업 디렉터리를 기준으로
 *                  풉니다. 컨테이너에서는 {@code /app/uploads/posts},
 *                  {@code ./gradlew bootRun} 으로 직접 띄우면 {@code backend/uploads/posts} 가
 *                  됩니다.
 *                  <p><b>프로필 이미지와 디렉터리를 겹치면 안 됩니다.</b> 같은 트리를 두
 *                  저장소가 함께 보면, 게시글 주소로 프로필 파일을 가리킬 수 있게 되고 그 글을
 *                  지우는 것만으로 남의 프로필 사진이 지워집니다.
 *                  <p><b>컨테이너를 다시 만들면 이 디렉터리는 사라집니다.</b> 배포 서버에서는
 *                  반드시 볼륨을 붙여야 합니다. 붙이지 않으면 다음 배포에서 그동안 올라온
 *                  이미지가 전부 없어지고 게시글에는 깨진 주소만 남습니다.
 * @param urlPath   저장한 파일을 돌려줄 주소의 앞부분입니다. 기본값이 {@code /api/v1} 아래인
 *                  이유는 배포 nginx 가 그 경로만 백엔드로 넘기기 때문입니다. 여기를 벗어난
 *                  주소로 바꾸면 nginx 설정을 함께 고치기 전까지 이미지가 404 가 됩니다.
 *                  <p>나중에 nginx 가 파일을 직접 내주게 되거나 저장소를 S3 로 옮기면 이 값만
 *                  바꿉니다. 이미 저장된 게시글의 주소는 그대로 두므로, 옮길 때는 기존 주소도
 *                  계속 닿는지 확인해야 합니다.
 * @param maxSize   파일 하나의 최대 크기입니다. {@code spring.servlet.multipart.max-file-size}
 *                  가 이 값보다 커야 합니다. 그래야 크기 초과를 이 애플리케이션이 먼저 잡아
 *                  도메인 에러 코드로 돌려줍니다. 반대로 두면 Spring 이 먼저 잘라내 공용
 *                  413 만 나갑니다.
 */
@Validated
@ConfigurationProperties(prefix = "hyanghae.community.post-image")
public record PostImageProperties(
        @DefaultValue("uploads/posts") @NotBlank String directory,
        @DefaultValue("/api/v1/posts/images") @NotBlank String urlPath,
        @DefaultValue("5MB") @NotNull DataSize maxSize
) {

    /**
     * {@link #directory} 를 절대 경로로 푼 값입니다.
     *
     * <p>저장할 때와 내줄 때가 같은 위치를 가리켜야 하므로 두 곳에서 각자 풀지 않고 여기서
     * 한 번만 풉니다. 상대 경로는 작업 디렉터리에 따라 달라지는데, 저장은 서비스가 하고
     * 내주는 것은 리소스 핸들러라 각자 풀면 어긋날 자리가 생깁니다.
     */
    public Path rootPath() {
        return Paths.get(directory).toAbsolutePath().normalize();
    }
}
