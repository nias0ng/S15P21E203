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
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.util.unit.DataSize;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;

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
 * <h2>⚠ 백엔드 키로는 객체를 읽을 수 없습니다 — 그게 맞습니다</h2>
 *
 * <p>{@code hyanghae-backend-dev} 에는 {@code s3:GetObject} 가 없습니다. {@link S3ImageStorage}
 * 가 {@code putObject} 와 {@code deleteObject} 만 부르기 때문입니다 — 읽기는 CloudFront 가 OAC
 * 로 합니다. 최소 권한이 제대로 잡혀 있는 것입니다.
 *
 * <p>그래서 <b>이 테스트는 S3 로 결과를 확인하지 않습니다.</b> {@code getObject} 나
 * {@code headObject} 로 확인하면(둘 다 {@code s3:GetObject} 가 필요합니다) 인프라가 멀쩡한데도
 * 403 으로 실패합니다. 확인은 전부 <b>CloudFront 를 통해</b> 합니다 — 브라우저가 보는 것과 같은
 * 경로라 오히려 이쪽이 실제에 가깝습니다.
 *
 * <p><b>개발 프리픽스에서만 돕니다.</b> {@link #refuseToRunOutsideTheDevPrefix()} 가 프리픽스에
 * {@code dev} 가 없으면 막습니다. 오타 하나로 운영 이미지 틈에 시험용 객체가 쌓이면 다시 찾아
 * 지우기 어렵습니다.
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
                // 이미 지워졌거나 권한이 없습니다. 정리 실패가 검증 결과를 덮지 않게 둡니다.
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
     *
     * <p>헤더도 여기서 함께 봅니다. S3 에 무엇이 저장됐는지가 아니라 <b>브라우저가 무엇을
     * 받는지</b>가 실제로 중요한 것이고, 백엔드 키로는 어차피 S3 를 읽을 수 없습니다.
     * {@code Content-Type} 이 빠지면 화면에 이미지 대신 내려받기가 뜹니다.
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
        assertThat(response.headers().firstValue("cache-control")).hasValue(CACHE_CONTROL);
        assertThat(response.body()).isEqualTo(PNG);
    }

    /**
     * <b>지우기 권한을 확인합니다.</b> 이것이 없으면 글에서 뗀 사진이 버킷에 영원히 남습니다.
     *
     * <p><b>지운 뒤에 처음으로 주소를 부릅니다.</b> 순서가 중요합니다 — 캐시 수명이 30일이라,
     * 지우기 전에 한 번이라도 부르면 엣지가 사본을 쥐고 지운 뒤에도 그대로 내려줍니다. 업로드마다
     * UUID 라 주소가 매번 새것이고, 그래서 이 첫 요청은 반드시 오리진까지 갑니다.
     *
     * <p>{@code deleteObject} 는 없는 키에도 성공합니다. 예외가 안 났다는 것만으로는 지워졌다고
     * 할 수 없어, 주소가 실제로 닫혔는지까지 봅니다.
     */
    @Test
    void deletesTheObjectSoItStopsServing() throws Exception {
        assumeThat(KEY_PREFIX).contains("dev");

        String imageUrl = save();

        storage.delete(imageUrl);

        assertThat(get(imageUrl).statusCode())
                .as("지웠는데 %s 가 아직 열립니다."
                        + " DeleteObject 권한이 없으면 뗀 사진이 버킷에 영원히 남습니다.", imageUrl)
                .isIn(403, 404);
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

    private static String env(String name, String fallback) {
        String value = System.getenv(name);
        return value == null || value.isBlank() ? fallback : value;
    }
}
