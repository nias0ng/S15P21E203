package com.hyanghae.backend.community.config;

import java.time.Duration;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.CacheControl;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * 올라온 게시글 이미지를 내주는 설정입니다.
 *
 * <p>왜 애플리케이션이 직접 내주는가: 배포 nginx 는 {@code /api} 만 백엔드로 넘기고 나머지는
 * 정적 파일 디렉터리에서 찾습니다. 그래서 {@code /uploads/...} 같은 주소를 쓰면 nginx 설정을
 * 함께 고치기 전까지 이미지가 404 가 됩니다. {@code /api/v1} 아래로 두면 이미 열려 있는 길로
 * 들어오므로 서버 설정을 건드리지 않고 동작합니다. 로컬에서 백엔드만 띄웠을 때도 똑같이
 * 동작한다는 점이 덤입니다.
 *
 * <p>나중에 이미지 요청이 많아지면 nginx 가 같은 경로를 디스크에서 바로 내주도록 바꾸면
 * 됩니다. 저장된 주소는 그대로 두고 앞단만 가로채는 것이라 데이터는 손댈 필요가 없습니다.
 *
 * <p>보안: 리소스 핸들러는 {@code ../} 로 저장 위치를 벗어나는 경로를 스스로 막습니다. 그리고
 * 파일 이름과 확장자를 올린 쪽이 정하지 못하므로({@code PostImageFormat} 참고) 여기서 나가는
 * 것은 우리가 형식을 확인한 이미지뿐입니다.
 */
@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties(PostImageProperties.class)
public class PostImageWebConfig implements WebMvcConfigurer {

    /**
     * 파일 이름이 임의의 UUID 라 같은 주소의 내용이 바뀌지 않습니다. 그래서 길게 캐시해도
     * 안전합니다. 짧게 잡으면 글을 볼 때마다 이미지를 다시 받아 갑니다.
     */
    private static final Duration CACHE_DURATION = Duration.ofDays(30);

    private final PostImageProperties properties;

    public PostImageWebConfig(PostImageProperties properties) {
        this.properties = properties;
    }

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        registry.addResourceHandler(properties.urlPath() + "/**")
                .addResourceLocations(location())
                .setCacheControl(CacheControl.maxAge(CACHE_DURATION).cachePublic());
    }

    /**
     * 디렉터리를 가리키는 {@code file:} URL 입니다.
     *
     * <p>끝의 {@code /} 를 직접 붙입니다. {@link java.nio.file.Path#toUri()} 는 디렉터리가
     * 실제로 있을 때만 붙여 주는데, 이 설정은 저장 디렉터리가 만들어지기 전에 등록될 수
     * 있습니다. {@code /} 가 없으면 Spring 이 상위 디렉터리를 기준으로 삼아 엉뚱한 파일을
     * 찾습니다.
     */
    private String location() {
        String uri = properties.rootPath().toUri().toString();
        return uri.endsWith("/") ? uri : uri + "/";
    }
}
