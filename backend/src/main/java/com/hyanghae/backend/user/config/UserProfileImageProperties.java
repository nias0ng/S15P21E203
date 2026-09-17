package com.hyanghae.backend.user.config;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.nio.file.Path;
import java.nio.file.Paths;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;
import org.springframework.util.unit.DataSize;
import org.springframework.validation.annotation.Validated;

/**
 * 프로필 이미지 설정입니다.
 *
 * <p>기본값을 yaml 이 아니라 여기에 둡니다. 프로필이 세 개라 yaml 에 두면 같은 값을 세 곳에
 * 적게 되고, 한 곳을 빼먹으면 그 프로필만 다르게 동작합니다.
 *
 * @param directory 파일을 쌓을 디렉터리입니다. <b>게시글 이미지와 겹치면 안 됩니다.</b> 같은
 *                  트리를 두 저장소가 함께 보면, 게시글 주소로 프로필 파일을 가리킬 수 있게
 *                  되고 그 글을 지우는 것만으로 남의 프로필 사진이 지워집니다.
 *                  <p>배포에서는 {@code /app/uploads} 볼륨 안에 들어가므로 게시글 이미지와
 *                  같은 볼륨을 씁니다. 볼륨을 따로 붙일 필요는 없습니다.
 * @param urlPath   저장한 파일을 돌려줄 주소의 앞부분입니다. {@code /api/v1} 아래인 이유는
 *                  배포 nginx 가 그 경로만 백엔드로 넘기기 때문입니다.
 *                  <p><b>{@code /api/v1/users/me} 아래로 두면 안 됩니다.</b> SecurityConfig 가
 *                  그 경로를 인증 필요로 막고 있어, 프로필 사진이 로그인한 사람에게만 보입니다.
 *                  남의 글 옆에 붙은 프로필 사진이 비회원에게 깨져 보입니다.
 * @param keyPrefix S3 에 쌓을 때의 키 앞부분입니다. 게시글 이미지와 겹치면 안 됩니다.
 *                  S3 를 쓰지 않으면 무시됩니다.
 * @param maxSize   파일 하나의 최대 크기입니다. 게시글 이미지(5MB)보다 작게 잡았습니다.
 *                  아바타는 화면에서 작게 보여주므로 그만한 원본이 필요 없고, 글마다 여러 개가
 *                  함께 내려가는 자리라 전송량이 곱절로 늘어납니다.
 */
@Validated
@ConfigurationProperties(prefix = "hyanghae.user.profile-image")
public record UserProfileImageProperties(
        @DefaultValue("uploads/profiles") @NotBlank String directory,
        @DefaultValue("/api/v1/users/profile-images") @NotBlank String urlPath,
        @DefaultValue("uploads/profiles") @NotBlank String keyPrefix,
        @DefaultValue("1MB") @NotNull DataSize maxSize
) {

    /**
     * {@link #directory} 를 절대 경로로 푼 값입니다. 저장할 때와 내줄 때가 같은 위치를
     * 가리켜야 하므로 두 곳에서 각자 풀지 않고 여기서 한 번만 풉니다.
     */
    public Path rootPath() {
        return Paths.get(directory).toAbsolutePath().normalize();
    }
}
