package com.hyanghae.backend.user.config;

import java.time.Duration;
import com.hyanghae.backend.global.storage.ImageStorageFactory;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.CacheControl;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * 올라온 프로필 이미지를 내주는 설정입니다.
 *
 * <p>애플리케이션이 직접 내주는 이유는 게시글 이미지와 같습니다 — 배포 nginx 가 {@code /api}
 * 만 백엔드로 넘기므로 그 아래에 두면 서버 설정을 건드리지 않고 동작합니다.
 *
 * <p>로그인 없이 볼 수 있어야 합니다. 프로필 사진은 글과 댓글 옆에 붙어 비회원에게도 보이는
 * 자리입니다. {@code SecurityConfig} 의 {@code GET /api/v1/**} 허용에 걸립니다.
 */
@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties(UserProfileImageProperties.class)
public class UserProfileImageWebConfig implements WebMvcConfigurer {

    /**
     * 파일 이름이 임의의 UUID 라 같은 주소의 내용이 바뀌지 않습니다. 프로필 사진을 바꾸면
     * 주소가 바뀌므로, 길게 캐시해도 낡은 사진이 남지 않습니다.
     */
    private static final Duration CACHE_DURATION = Duration.ofDays(30);

    private final UserProfileImageProperties properties;
    private final ImageStorageFactory storageFactory;

    public UserProfileImageWebConfig(UserProfileImageProperties properties, ImageStorageFactory storageFactory) {
        this.properties = properties;
        this.storageFactory = storageFactory;
    }

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        // S3 에 쌓는 환경에서는 CloudFront 가 내주므로 여기서 할 일이 없습니다. 그래도
        // 등록하면 쓰지도 않을 로컬 디렉터리를 만들게 됩니다.
        if (storageFactory.usesS3()) {
            return;
        }
        registry.addResourceHandler(properties.urlPath() + "/**")
                .addResourceLocations(location())
                .setCacheControl(CacheControl.maxAge(CACHE_DURATION).cachePublic());
    }

    /**
     * 디렉터리를 가리키는 {@code file:} URL 입니다. 끝의 {@code /} 를 직접 붙입니다 —
     * {@link java.nio.file.Path#toUri()} 는 디렉터리가 실제로 있을 때만 붙여 주는데, 이 설정은
     * 저장 디렉터리가 만들어지기 전에 등록될 수 있습니다.
     */
    private String location() {
        String uri = properties.rootPath().toUri().toString();
        return uri.endsWith("/") ? uri : uri + "/";
    }
}
