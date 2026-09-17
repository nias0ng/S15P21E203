package com.hyanghae.backend.global.storage;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assumptions.assumeThat;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.util.unit.DataSize;
import software.amazon.awssdk.core.ResponseInputStream;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;
import software.amazon.awssdk.services.s3.model.NoSuchKeyException;

/**
 * <b>실제 AWS 를 칩니다.</b> {@link S3ImageStorageTest} 가 LocalStack 으로 확인하지 못하는 것만
 * 봅니다 — IAM 권한, 자격 증명 해석, 그리고 <b>CloudFront 가 우리가 올린 객체를 실제로 내려주는지</b>.
 *
 * <p>기본은 <b>꺼져 있습니다.</b> {@code HYANGHAE_REAL_S3_CHECK=true} 일 때만 돕니다. 평소
 * {@code ./gradlew test} 와 CI 는 AWS 를 건드리지 않아야 합니다 — 계정 없이도 전체가 통과해야
 * 하고, 테스트가 공용 버킷에 객체를 남겨서도 안 됩니다.
 *
 * <p><b>자격 증명을 인자로 받지 않습니다.</b> AWS SDK 의 기본 탐색 순서를 그대로 씁니다
 * ({@code AWS_ACCESS_KEY_ID}/{@code AWS_SECRET_ACCESS_KEY} 환경변수 · {@code ~/.aws/credentials}
 * · EC2 인스턴스 역할). 키가 코드나 설정 파일을 거치지 않아 저장소에 커밋될 길이 없습니다.
 *
 * <p><b>개발 프리픽스에서만 돕니다.</b> 아래 {@link #refuseToRunOutsideTheDevPrefix()} 가
 * 프리픽스에 {@code dev} 가 없으면 시작을 막습니다. 오타 하나로 운영 경로에 시험용 객체가
 * 쌓이는 것을 코드로 막아 둡니다.
 *
 * <h2>실행</h2>
 *
 * <pre>
 * $env:AWS_ACCESS_KEY_ID = "..."        # 이 셸에서만. 파일이나 저장소에 넣지 않습니다.
 * $env:AWS_SECRET_ACCESS_KEY = "..."
 * $env:HYANGHAE_REAL_S3_CHECK = "true"
 * ./gradlew test --tests '*RealS3ConnectivityTest*'
 * </pre>
 *
 * <p>확인이 끝나면 셸을 닫거나 {@code Remove-Item Env:AWS_ACCESS_KEY_ID} 로 지웁니다.
 *
 * <h2>이 테스트가 증명하지 못하는 것</h2>
 *
 * <p><b>배포 서버의 자격 증명 경로는 확인되지 않습니다.</b> 여기서 쓰는 것은 IAM 액세스 키이고,
 * 운영이 EC2 인스턴스 역할을 쓴다면 그것은 <b>다른 주체</b>입니다. 키가 통해도 인스턴스 역할에
 * 같은 권한이 붙어 있는지는 배포해 봐야 압니다.
 *
 * <p>운영 프리픽스({@code uploads})에 대한 쓰기 권한도 확인되지 않습니다. 여기서는 개발
 * 프리픽스만 건드립니다.
 */
@EnabledIfEnvironmentVariable(
        named = "HYANGHAE_REAL_S3_CHECK",
        matches = "true",
        disabledReason = "실제 AWS 를 칩니다. HYANGHAE_REAL_S3_CHECK=true 일 때만 돕니다.")
class RealS3ConnectivityTest {

    private static final String BUCKET =
            env("HYANGHAE_REAL_S3_BUCKET", "hyanghae-images-prod-s15p21e203");
    private static final String REGION = env("HYANGHAE_REAL_S3_REGION", "ap-northeast-2");
    private static final String PUBLIC_BASE_URL =
            env("HYANGHAE_REAL_S3_PUBLIC_BASE_URL", "https://djpgc0m2v54q1.cloudfront.net");
    /** 도메인 부분까지 포함한 최종 프리픽스입니다. 운영은 {@code uploads/posts} 가 됩니다. */
    private static final String KEY_PREFIX =
            env("HYANGHAE_REAL_S3_KEY_PREFIX", "uploads/dev/posts");
    private static final String CACHE_CONTROL = "public, max-age=2592000";

    /** 1x1 투명 PNG. 내용이 아니라 <b>경로 · 헤더 · 전달</b>을 보는 것이라 작을수록 좋습니다. */
    private static final byte[] PNG = Base64.getDecoder().decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA"
                    + "60e6kgAAAABJRU5ErkJggg==");

    private static S3Client client;
    private static S3ImageStorage storage;
    private static HttpClient http;

    private final List<String> createdKeys = new ArrayList<>();

    @BeforeAll
    static void openRealS3() {
        // 자격 증명을 지정하지 않습니다. S3ClientProvider 가 운영에서 하는 것과 같습니다 —
        // 여기서 provider 를 박으면 운영과 다른 경로를 검증하게 됩니다.
        client = S3Client.builder()
                .region(Region.of(REGION))
                .build();
        storage = new S3ImageStorage(client, BUCKET, KEY_PREFIX, KEY_PREFIX,
                PUBLIC_BASE_URL, CACHE_CONTROL, DataSize.ofMegabytes(5));
        http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
    }

    @AfterAll
    static void closeRealS3() {
        if (client != null) {
            client.close();
        }
    }

    /** 실패하든 통과하든 올린 것은 지웁니다. 공용 버킷에 시험용 객체를 남기지 않습니다. */
    @AfterEach
    void removeWhatThisTestCreated() {
        for (String key : createdKeys) {
            try {
                client.deleteObject(DeleteObjectRequest.builder()
                        .bucket(BUCKET).key(key).build());
            } catch (RuntimeException ignored) {
                // 이미 지워진 객체입니다. 정리 실패가 검증 결과를 덮지 않게 둡니다.
            }
        }
        createdKeys.clear();
    }

    /**
     * <b>운영 경로에서는 아예 돌지 않습니다.</b> 프리픽스를 잘못 주면 시험용 객체가 운영 이미지
     * 틈에 쌓이고, 그것을 다시 찾아 지우기 어렵습니다.
     */
    @Test
    void refuseToRunOutsideTheDevPrefix() {
        assertThat(KEY_PREFIX)
                .as("이 테스트는 개발 프리픽스에서만 돕니다 — HYANGHAE_REAL_S3_KEY_PREFIX 를 확인하세요")
                .contains("dev");
    }

    /**
     * <b>이것이 이 테스트의 이유입니다.</b> 올린 객체가 CloudFront 로 실제로 내려오는지는
     * LocalStack 으로 확인할 수 없습니다 — 버킷 정책 · OAC · 비헤이비어가 맞아야 열립니다.
     *
     * <p>403 이면 CloudFront 가 버킷을 읽지 못하는 것이고, 404 면 주소와 키가 어긋난 것입니다
     * (오리진 경로 설정 — {@code IMAGE_STORAGE_S3_PUBLIC_PATH_PREFIX} 를 보십시오).
     */
    @Test
    void servesTheUploadedObjectThroughCloudFront() throws Exception {
        assumeThat(KEY_PREFIX).contains("dev");

        String imageUrl = save();

        assertThat(imageUrl).startsWith(PUBLIC_BASE_URL + "/" + KEY_PREFIX + "/");

        HttpResponse<byte[]> response = get(imageUrl);

        assertThat(response.statusCode())
                .as("CloudFront 가 %s 를 내려주지 못했습니다."
                        + " 403 이면 버킷 정책·OAC, 404 면 오리진 경로 설정입니다.", imageUrl)
                .isEqualTo(200);
        assertThat(response.headers().firstValue("content-type"))
                .as("Content-Type 이 image/png 가 아니면 브라우저가 내려받기를 띄웁니다")
                .hasValue("image/png");
        assertThat(response.body()).isEqualTo(PNG);
    }

    /** 올린 그대로가 S3 에 있고, {@code Content-Type} 이 붙어 있어야 합니다. */
    @Test
    void writesTheObjectWithItsContentType() {
        assumeThat(KEY_PREFIX).contains("dev");

        String key = keyOf(save());

        GetObjectResponse stored = headOf(key);

        assertThat(stored.contentType()).isEqualTo("image/png");
        assertThat(stored.cacheControl()).isEqualTo(CACHE_CONTROL);
    }

    /**
     * <b>지우기 권한을 확인합니다.</b> 이것이 없으면 글에서 뗀 사진이 버킷에 영원히 남습니다.
     *
     * <p>CloudFront 가 아니라 S3 를 확인합니다. 캐시 수명이 30일이라 지운 뒤에도 엣지는 한동안
     * 그대로 내려줍니다 — CloudFront 가 404 가 되기를 기다리면 이 테스트는 절대 통과하지
     * 못합니다.
     */
    @Test
    void deletesTheObjectFromTheBucket() {
        assumeThat(KEY_PREFIX).contains("dev");

        String imageUrl = save();
        String key = keyOf(imageUrl);
        assertThat(objectExists(key)).isTrue();

        storage.delete(imageUrl);

        assertThat(objectExists(key))
                .as("DeleteObject 권한이 없으면 뗀 사진이 버킷에 영원히 남습니다")
                .isFalse();
    }

    private String save() {
        String imageUrl = storage.save(new MockMultipartFile(
                "image", "probe.png", MediaType.IMAGE_PNG_VALUE, PNG));
        createdKeys.add(keyOf(imageUrl));
        return imageUrl;
    }

    private HttpResponse<byte[]> get(String url) throws IOException, InterruptedException {
        return http.send(
                HttpRequest.newBuilder(URI.create(url)).GET()
                        .timeout(Duration.ofSeconds(20)).build(),
                HttpResponse.BodyHandlers.ofByteArray());
    }

    private String keyOf(String imageUrl) {
        return imageUrl.substring(PUBLIC_BASE_URL.length() + 1);
    }

    private GetObjectResponse headOf(String key) {
        try (ResponseInputStream<GetObjectResponse> object = client.getObject(
                GetObjectRequest.builder().bucket(BUCKET).key(key).build())) {
            return object.response();
        } catch (IOException exception) {
            throw new IllegalStateException("cannot read " + key, exception);
        }
    }

    private boolean objectExists(String key) {
        try {
            headOf(key);
            return true;
        } catch (NoSuchKeyException exception) {
            return false;
        }
    }

    private static String env(String name, String fallback) {
        String value = System.getenv(name);
        return value == null || value.isBlank() ? fallback : value;
    }
}
