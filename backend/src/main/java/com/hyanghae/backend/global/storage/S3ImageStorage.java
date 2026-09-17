package com.hyanghae.backend.global.storage;

import java.io.IOException;
import java.io.InputStream;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.util.unit.DataSize;
import org.springframework.web.multipart.MultipartFile;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.model.S3Exception;

/**
 * 이미지를 S3 에 쌓고 CloudFront 주소로 돌려주는 저장소입니다.
 *
 * <p>카탈로그 이미지(노트 · 향수)가 이미 같은 버킷과 배포를 쓰고 있어, 사용자 업로드도 같은
 * 경로로 합칩니다. 그래야 화면이 주소 형태를 하나로 다루고, CDN 캐싱과 여러 대 서버가 따라
 * 옵니다.
 *
 * <p><b>읽기는 이 코드를 거치지 않습니다.</b> 버킷은 CloudFront 만 읽을 수 있게 잠겨 있고,
 * 백엔드는 쓰고 지우기만 합니다. 그래서 여기 필요한 권한도 {@code PutObject} 와
 * {@code DeleteObject} 둘뿐입니다.
 */
public class S3ImageStorage extends ImageStorage {

    private static final Logger log = LoggerFactory.getLogger(S3ImageStorage.class);

    private final S3Client client;
    private final String bucket;

    /** S3 키의 앞부분입니다. 환경 프리픽스와 도메인 프리픽스를 이어 붙인 값입니다. */
    private final String keyPrefix;

    /** 주소의 앞부분입니다. 보통 {@link #keyPrefix} 와 같지만 다를 수 있습니다 — 아래 설명. */
    private final String publicPathPrefix;

    private final String publicBaseUrl;
    private final String cacheControl;

    /**
     * @param keyPrefix     이 저장소가 쓰는 S3 키 앞부분입니다(예: {@code uploads/posts}).
     *                      저장소마다 달라야 합니다 — 겹치면 한쪽 주소로 다른 쪽 객체를 가리킬
     *                      수 있고, 그쪽에서 지우라고 부르면 남의 도메인 파일이 지워집니다.
     * @param publicBaseUrl CloudFront 배포 주소입니다. 끝의 {@code /} 는 있어도 없어도 됩니다.
     */
    public S3ImageStorage(
            S3Client client,
            String bucket,
            String keyPrefix,
            String publicPathPrefix,
            String publicBaseUrl,
            String cacheControl,
            DataSize maxSize
    ) {
        super(maxSize);
        this.client = client;
        this.bucket = bucket;
        this.keyPrefix = trimSlashes(keyPrefix);
        this.publicPathPrefix = trimSlashes(publicPathPrefix);
        this.publicBaseUrl = stripTrailingSlash(publicBaseUrl);
        this.cacheControl = cacheControl;
    }

    /**
     * {@code Content-Type} 을 명시적으로 넣습니다.
     *
     * <p><b>S3 는 확장자로 타입을 추론하지 않습니다.</b> 넣지 않으면 기본값
     * {@code binary/octet-stream} 으로 저장되고, CloudFront 가 그대로 내려 브라우저는 이미지를
     * 그리는 대신 내려받기를 시작합니다. 확장자가 {@code .png} 라도 그렇습니다.
     *
     * <p>타입은 보낸 헤더가 아니라 <b>파일 내용에서 알아낸 형식</b>에서 옵니다. 보낸 값을 쓰면
     * HTML 을 {@code text/html} 로 저장해 우리 도메인에서 실행시킬 수 있습니다.
     */
    @Override
    protected void put(MultipartFile file, String relativePath, ImageFormat format) {
        String key = keyOf(relativePath);
        PutObjectRequest request = PutObjectRequest.builder()
                .bucket(bucket)
                .key(key)
                .contentType(format.contentType())
                .contentLength(file.getSize())
                .cacheControl(cacheControl)
                .build();

        try (InputStream input = file.getInputStream()) {
            client.putObject(request, RequestBody.fromInputStream(input, file.getSize()));
        } catch (IOException | S3Exception exception) {
            log.error("Failed to store image: bucket={}, key={}", bucket, key, exception);
            throw new ImageStorageException(ImageStorageException.Reason.SAVE_FAILED);
        }

        // 누가 올렸는지는 넣지 않습니다. 같은 줄에 requestId 가 찍히고, 그 값으로
        // RequestIdFilter 의 요청 로그를 찾으면 됩니다. 보낸 파일 이름도 넣지 않습니다.
        log.debug(
                "Image stored: bucket={}, key={}, format={}, sizeBytes={}",
                bucket, key, format.name(), file.getSize());
    }

    @Override
    protected void remove(String relativePath) {
        String key = keyOf(relativePath);
        try {
            client.deleteObject(DeleteObjectRequest.builder()
                    .bucket(bucket)
                    .key(key)
                    .build());
            log.debug("Image deleted: bucket={}, key={}", bucket, key);
        } catch (S3Exception exception) {
            log.warn("Failed to delete image: bucket={}, key={}", bucket, key, exception);
        }
    }

    /**
     * 화면이 쓸 주소입니다.
     *
     * <p><b>키와 주소가 다를 수 있습니다.</b> CloudFront 배포가 버킷 뿌리를 가리키면 주소에도
     * 환경 프리픽스가 그대로 나와야 하고, 배포의 오리진 경로가 이미 그 프리픽스를 가리키면
     * 주소에는 나오면 안 됩니다. 나오면 안 될 때 주소에 넣으면 프리픽스가 두 번 들어가 404 가
     * 납니다.
     */
    @Override
    protected String publicUrl(String relativePath) {
        return join(publicBaseUrl, publicPathPrefix, relativePath);
    }

    /**
     * 주소를 이 저장소의 상대 경로로 되돌립니다.
     *
     * <p>{@code ..} 가 든 주소는 받지 않습니다. S3 키에는 경로 탈출이라는 개념이 없지만, 그런
     * 주소는 우리가 만든 것이 아니므로 애초에 손대지 않는 편이 맞습니다.
     */
    @Override
    protected String relativePathOf(String imageUrl) {
        if (imageUrl == null) {
            return null;
        }
        String prefix = join(publicBaseUrl, publicPathPrefix, "");
        if (!imageUrl.startsWith(prefix)) {
            return null;
        }
        String relativePath = imageUrl.substring(prefix.length());
        return relativePath.contains("..") ? null : relativePath;
    }

    private String keyOf(String relativePath) {
        return keyPrefix.isEmpty() ? relativePath : keyPrefix + "/" + relativePath;
    }

    /**
     * 빈 조각을 건너뛰고 {@code /} 로 잇습니다. 프리픽스가 비었을 때 {@code //} 가 생기면
     * S3 는 이름이 빈 폴더로 보고, 주소는 다른 경로가 됩니다.
     */
    private static String join(String base, String prefix, String rest) {
        StringBuilder joined = new StringBuilder(base);
        if (!prefix.isEmpty()) {
            joined.append('/').append(prefix);
        }
        if (!rest.isEmpty()) {
            joined.append('/').append(rest);
        } else {
            joined.append('/');
        }
        return joined.toString();
    }

    private static String trimSlashes(String value) {
        String trimmed = value.strip();
        if (trimmed.startsWith("/")) {
            trimmed = trimmed.substring(1);
        }
        return stripTrailingSlash(trimmed);
    }

    private static String stripTrailingSlash(String value) {
        String trimmed = value.strip();
        return trimmed.endsWith("/") ? trimmed.substring(0, trimmed.length() - 1) : trimmed;
    }
}
