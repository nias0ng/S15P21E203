package com.hyanghae.backend.global.storage;

import java.nio.file.Path;
import org.springframework.stereotype.Component;
import org.springframework.util.unit.DataSize;

/**
 * 도메인별 설정을 받아 알맞은 저장소를 만들어 줍니다.
 *
 * <p>도메인 서비스가 {@code new LocalImageStorage(...)} 를 직접 부르면 S3 로 바꿀 때 도메인마다
 * 고쳐야 합니다. 뒷단을 고르는 판단을 여기 한 곳에 모아 두면 설정 한 줄로 전부 바뀝니다.
 *
 * <p>도메인마다 저장소를 하나씩 만듭니다. 크기 제한과 경로가 다르고, <b>경로가 겹치면 한쪽
 * 주소로 다른 쪽 파일을 가리킬 수 있어</b> 공유하면 안 됩니다.
 */
@Component
public class ImageStorageFactory {

    private final ImageStorageProperties properties;
    private final S3ClientProvider s3ClientProvider;

    public ImageStorageFactory(
            ImageStorageProperties properties,
            S3ClientProvider s3ClientProvider
    ) {
        this.properties = properties;
        this.s3ClientProvider = s3ClientProvider;
    }

    /**
     * @param localDirectory S3 를 쓰지 않을 때 파일을 쌓을 디렉터리
     * @param localUrlPath   S3 를 쓰지 않을 때 돌려줄 주소의 앞부분
     * @param s3KeyPrefix    S3 를 쓸 때의 키 앞부분(예: {@code uploads/posts})
     */
    public ImageStorage create(
            Path localDirectory,
            String localUrlPath,
            String s3KeyPrefix,
            DataSize maxSize
    ) {
        ImageStorageProperties.S3 s3 = properties.s3();
        if (!s3.enabled()) {
            return new LocalImageStorage(localDirectory, localUrlPath, maxSize);
        }
        return new S3ImageStorage(
                s3ClientProvider.client(),
                s3.bucket(),
                s3KeyPrefix,
                s3.publicBaseUrl(),
                s3.cacheControl(),
                maxSize
        );
    }

    /** 지금 S3 에 쌓고 있는지입니다. 리소스 핸들러 등록 여부를 정하는 데 씁니다. */
    public boolean usesS3() {
        return properties.s3().enabled();
    }
}
