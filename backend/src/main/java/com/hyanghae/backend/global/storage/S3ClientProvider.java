package com.hyanghae.backend.global.storage;

import java.net.URI;
import org.springframework.stereotype.Component;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3ClientBuilder;

/**
 * {@link S3Client} 를 필요할 때 한 번만 만들어 들고 있습니다.
 *
 * <p><b>빈으로 두지 않는 이유</b>: S3 를 끄고 쓰는 환경(로컬 개발 · 테스트)에서도 빈은 만들어
 * 집니다. {@code S3Client} 는 만들 때 자격 증명과 리전을 찾는데, 그것이 없는 환경에서는 그
 * 순간 애플리케이션이 뜨지 않습니다. 여기서 늦게 만들면 S3 를 켠 환경에서만 만들어집니다.
 *
 * <p>자격 증명은 SDK 의 기본 탐색 순서를 그대로 씁니다 — 환경변수, 그다음 EC2 인스턴스 역할.
 * 키를 설정 파일로 받지 않는 것은 저장소에 커밋될 길을 막기 위해서입니다.
 *
 * <p>{@code endpointOverride} 는 테스트에서 LocalStack 을 가리키는 용도입니다. 운영에서는
 * 비워 두고 SDK 가 정하는 실제 S3 주소를 씁니다.
 */
@Component
public class S3ClientProvider {

    private final ImageStorageProperties properties;

    private volatile S3Client client;

    public S3ClientProvider(ImageStorageProperties properties) {
        this.properties = properties;
    }

    public S3Client client() {
        S3Client existing = client;
        if (existing != null) {
            return existing;
        }
        synchronized (this) {
            if (client == null) {
                client = build();
            }
            return client;
        }
    }

    private S3Client build() {
        ImageStorageProperties.S3 s3 = properties.s3();
        S3ClientBuilder builder = S3Client.builder().region(Region.of(s3.region()));
        if (!s3.endpointOverride().isBlank()) {
            builder.endpointOverride(URI.create(s3.endpointOverride()))
                    // LocalStack 은 가상 호스트 방식(버킷이 호스트명에 들어가는)을 기본으로는
                    // 풀지 못합니다. 경로 방식으로 강제해야 붙습니다.
                    .forcePathStyle(true);
        }
        return builder.build();
    }
}
