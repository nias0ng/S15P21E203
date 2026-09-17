package com.hyanghae.backend.global.storage;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.util.unit.DataSize;
import org.testcontainers.containers.localstack.LocalStackContainer;
import org.testcontainers.utility.DockerImageName;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.ResponseInputStream;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.CreateBucketRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;
import software.amazon.awssdk.services.s3.model.NoSuchKeyException;

/**
 * S3 저장소를 <b>실제 S3 API 위에서</b> 검증합니다. LocalStack 컨테이너를 씁니다.
 *
 * <p>목으로 대신하지 않는 이유가 있습니다. 여기서 확인해야 하는 것은 "SDK 를 불렀는가"가
 * 아니라 <b>무엇이 실제로 저장됐는가</b>입니다 — 키가 어디에 놓였는지, {@code Content-Type} 이
 * 무엇으로 붙었는지는 목으로는 드러나지 않습니다.
 *
 * <p>특히 {@code Content-Type} 이 중요합니다. S3 는 확장자로 타입을 추론하지 않아, 넣지 않으면
 * {@code binary/octet-stream} 으로 저장되고 CloudFront 가 그대로 내려 브라우저가 이미지를
 * 그리는 대신 내려받기를 시작합니다.
 *
 * <p>AWS 계정이 필요 없습니다. Docker 만 있으면 됩니다.
 */
class S3ImageStorageTest {

    private static final String BUCKET = "hyanghae-test";
    private static final String KEY_PREFIX = "uploads/posts";
    private static final String PUBLIC_BASE_URL = "https://djpgc0m2v54q1.cloudfront.net";
    private static final String CACHE_CONTROL = "public, max-age=2592000";

    private static LocalStackContainer localstack;
    private static S3Client client;
    private static S3ImageStorage storage;

    @BeforeAll
    static void startLocalStack() {
        localstack = new LocalStackContainer(
                DockerImageName.parse("localstack/localstack:3.8"))
                .withServices(LocalStackContainer.Service.S3);
        localstack.start();

        client = S3Client.builder()
                .endpointOverride(URI.create(localstack.getEndpoint().toString()))
                .region(Region.of(localstack.getRegion()))
                .credentialsProvider(StaticCredentialsProvider.create(
                        AwsBasicCredentials.create(
                                localstack.getAccessKey(), localstack.getSecretKey())))
                // LocalStack 은 가상 호스트 방식을 기본으로 풀지 못해 경로 방식이어야 합니다.
                .forcePathStyle(true)
                .build();
        client.createBucket(CreateBucketRequest.builder().bucket(BUCKET).build());

        storage = new S3ImageStorage(client, BUCKET, KEY_PREFIX, KEY_PREFIX,
                PUBLIC_BASE_URL, CACHE_CONTROL, DataSize.ofMegabytes(5));
    }

    @AfterAll
    static void stopLocalStack() {
        if (client != null) {
            client.close();
        }
        if (localstack != null) {
            localstack.stop();
        }
    }

    /**
     * 올린 객체가 키 앞부분 아래에 놓이고, 돌려준 주소가 CloudFront 를 가리켜야 합니다.
     *
     * <p><b>S3 객체 주소를 돌려주면 안 됩니다.</b> 버킷은 CloudFront 만 읽을 수 있게 잠겨 있어
     * 사용자가 403 을 받습니다.
     */
    @Test
    void storesObjectUnderKeyPrefixAndReturnsCloudFrontUrl() {
        String imageUrl = storage.save(pngFile());

        assertThat(imageUrl).startsWith(PUBLIC_BASE_URL + "/" + KEY_PREFIX + "/");
        assertThat(imageUrl).endsWith(".png");
        assertThat(imageUrl).doesNotContain("s3.");
        assertThat(imageUrl).doesNotContain(BUCKET);

        assertThat(objectExists(keyOf(imageUrl))).isTrue();
    }

    /**
     * <b>{@code Content-Type} 을 넣지 않으면 브라우저가 이미지를 그리지 않습니다.</b> S3 는
     * 확장자로 타입을 추론하지 않아, 이 단언이 깨지면 화면에서 이미지 대신 내려받기가 뜹니다.
     */
    @Test
    void setsContentTypeFromTheDetectedFormat() {
        String imageUrl = storage.save(pngFile());

        GetObjectResponse stored = headOf(keyOf(imageUrl));

        assertThat(stored.contentType()).isEqualTo(MediaType.IMAGE_PNG_VALUE);
        assertThat(stored.cacheControl()).isEqualTo(CACHE_CONTROL);
    }

    /**
     * 타입은 보낸 헤더가 아니라 파일 내용에서 옵니다. 보낸 값을 그대로 쓰면 HTML 을
     * {@code text/html} 로 저장해 우리 도메인에서 실행시킬 수 있습니다.
     */
    @Test
    void ignoresTheClientSuppliedContentType() {
        MockMultipartFile lying = new MockMultipartFile(
                "file", "photo.gif", MediaType.IMAGE_GIF_VALUE, pngBytes());

        String imageUrl = storage.save(lying);

        assertThat(imageUrl).endsWith(".png");
        assertThat(headOf(keyOf(imageUrl)).contentType()).isEqualTo(MediaType.IMAGE_PNG_VALUE);
    }

    @Test
    void rejectsContentThatIsNotAnImage() {
        MockMultipartFile html = new MockMultipartFile("file", "photo.png",
                MediaType.IMAGE_PNG_VALUE,
                "<html><script>alert(1)</script></html>".getBytes(StandardCharsets.UTF_8));

        assertThatThrownBy(() -> storage.save(html))
                .isInstanceOf(ImageStorageException.class)
                .extracting(exception -> ((ImageStorageException) exception).reason())
                .isEqualTo(ImageStorageException.Reason.TYPE_NOT_ALLOWED);
    }

    @Test
    void deletesTheObjectBehindAnUrl() {
        String imageUrl = storage.save(pngFile());
        assertThat(objectExists(keyOf(imageUrl))).isTrue();

        storage.delete(imageUrl);

        assertThat(objectExists(keyOf(imageUrl))).isFalse();
    }

    /**
     * 우리가 만들지 않은 주소는 건드리지 않습니다. 없는 객체를 지우려 들어도 예외를 올리지
     * 않아야 합니다 — 부르는 쪽은 이미 커밋을 마친 뒤입니다.
     */
    @Test
    void ignoresUrlsFromElsewhere() {
        String other = storage.save(pngFile());
        String otherKey = keyOf(other);

        storage.delete("https://example.test/photo.png");
        storage.delete("/api/v1/posts/images/2026/09/local.png");
        storage.delete(PUBLIC_BASE_URL + "/uploads/profiles/2026/09/someone.png");
        storage.delete(PUBLIC_BASE_URL + "/" + KEY_PREFIX + "/../../notes/musk.jpg");
        storage.delete(null);

        assertThat(objectExists(otherKey))
                .as("다른 저장소·외부 주소로는 우리 객체가 지워지면 안 됩니다")
                .isTrue();
    }

    /**
     * 같은 파일을 두 번 올리면 서로 다른 키가 나와야 합니다. 내용으로 이름을 지으면 다른
     * 사람이 올린 같은 그림을 한 객체에 모으게 되고, 한 명이 지울 때 나머지가 함께 깨집니다.
     */
    @Test
    void givesEachUploadItsOwnKey() {
        String first = storage.save(pngFile());
        String second = storage.save(pngFile());

        assertThat(first).isNotEqualTo(second);
        assertThat(objectExists(keyOf(first))).isTrue();
        assertThat(objectExists(keyOf(second))).isTrue();
    }

    /**
     * <b>배포가 버킷 뿌리를 가리키는 경우</b>입니다. 환경 프리픽스가 키에도, 주소에도 나옵니다.
     *
     * <p>개발과 운영이 CloudFront 주소를 같이 쓰고 경로로 나누는 구성입니다.
     */
    @Test
    void putsEnvironmentPrefixInBothKeyAndUrlWhenDistributionServesBucketRoot() {
        S3ImageStorage prod = new S3ImageStorage(
                client, BUCKET, "prod/uploads/posts", "prod/uploads/posts",
                PUBLIC_BASE_URL, CACHE_CONTROL, DataSize.ofMegabytes(5));

        String imageUrl = prod.save(pngFile());

        assertThat(imageUrl).startsWith(PUBLIC_BASE_URL + "/prod/uploads/posts/");
        assertThat(objectExists(imageUrl.substring(PUBLIC_BASE_URL.length() + 1))).isTrue();

        prod.delete(imageUrl);
        assertThat(objectExists(imageUrl.substring(PUBLIC_BASE_URL.length() + 1))).isFalse();
    }

    /**
     * <b>배포의 오리진 경로가 이미 환경 프리픽스를 가리키는 경우</b>입니다. 키에는 넣되
     * 주소에는 넣지 않아야 합니다.
     *
     * <p>주소에 넣으면 프리픽스가 두 번 들어가({@code /prod/prod/...}) 404 가 납니다. 반대로
     * 키에서 빼면 다른 환경의 객체를 건드립니다.
     */
    @Test
    void keepsEnvironmentPrefixOutOfUrlWhenDistributionOriginPathCoversIt() {
        S3ImageStorage prod = new S3ImageStorage(
                client, BUCKET, "prod/uploads/posts", "uploads/posts",
                PUBLIC_BASE_URL, CACHE_CONTROL, DataSize.ofMegabytes(5));

        String imageUrl = prod.save(pngFile());

        assertThat(imageUrl).startsWith(PUBLIC_BASE_URL + "/uploads/posts/");
        assertThat(imageUrl).doesNotContain("/prod/");

        // 주소에는 없지만 객체는 prod/ 아래에 있어야 합니다.
        String relative = imageUrl.substring((PUBLIC_BASE_URL + "/uploads/posts/").length());
        assertThat(objectExists("prod/uploads/posts/" + relative)).isTrue();

        prod.delete(imageUrl);
        assertThat(objectExists("prod/uploads/posts/" + relative)).isFalse();
    }

    /**
     * 환경이 다르면 서로의 객체를 건드리지 못합니다. 개발에서 지운다고 운영 사진이 사라지면
     * 안 됩니다.
     */
    @Test
    void keepsEnvironmentsIsolated() {
        S3ImageStorage prod = new S3ImageStorage(
                client, BUCKET, "prod/uploads/posts", "prod/uploads/posts",
                PUBLIC_BASE_URL, CACHE_CONTROL, DataSize.ofMegabytes(5));
        S3ImageStorage dev = new S3ImageStorage(
                client, BUCKET, "dev/uploads/posts", "dev/uploads/posts",
                PUBLIC_BASE_URL, CACHE_CONTROL, DataSize.ofMegabytes(5));

        String prodUrl = prod.save(pngFile());
        String prodKey = prodUrl.substring(PUBLIC_BASE_URL.length() + 1);

        // 운영 주소를 개발 저장소에 넘겨도 무시해야 합니다 — 프리픽스가 다릅니다.
        dev.delete(prodUrl);

        assertThat(objectExists(prodKey))
                .as("개발 저장소가 운영 객체를 지우면 안 됩니다")
                .isTrue();
    }

    /**
     * <b>실제로 받은 설정 그대로</b> 확인합니다 — 버킷 하나에 운영 {@code uploads},
     * 개발 {@code uploads/dev}, CloudFront 는 버킷 뿌리를 서빙합니다.
     *
     * <p>카탈로그 이미지가 {@code .../perfumes/65738/original.png} 로 열리는 것이 뿌리 서빙의
     * 증거입니다. 그래서 주소에 환경 프리픽스가 그대로 나옵니다.
     */
    @Test
    void matchesTheRealDeploymentLayout() {
        S3ImageStorage prod = storageFor("uploads/posts");
        S3ImageStorage dev = storageFor("uploads/dev/posts");

        String prodUrl = prod.save(pngFile());
        String devUrl = dev.save(pngFile());

        assertThat(prodUrl).startsWith(PUBLIC_BASE_URL + "/uploads/posts/");
        assertThat(devUrl).startsWith(PUBLIC_BASE_URL + "/uploads/dev/posts/");
        assertThat(objectExists(keyOf(prodUrl))).isTrue();
        assertThat(objectExists(keyOf(devUrl))).isTrue();
    }

    /**
     * <b>개발은 운영 객체를 건드리지 못합니다.</b> 이 방향이 중요합니다 — 개발에서 실수해도
     * 운영 사진이 사라지면 안 됩니다.
     *
     * <p>개발 프리픽스({@code uploads/dev})가 운영({@code uploads})보다 길어서, 운영 주소는
     * 개발 저장소의 접두사와 맞지 않습니다.
     */
    @Test
    void devCannotTouchProdObjects() {
        S3ImageStorage prod = storageFor("uploads/posts");
        S3ImageStorage dev = storageFor("uploads/dev/posts");

        String prodUrl = prod.save(pngFile());

        dev.delete(prodUrl);

        assertThat(objectExists(keyOf(prodUrl)))
                .as("개발 저장소가 운영 객체를 지우면 안 됩니다")
                .isTrue();
    }

    /**
     * <b>운영도 개발 객체를 건드리지 못합니다.</b> 프리픽스가 겹쳐 보이지만 실제로는 안
     * 겹칩니다.
     *
     * <p>개발 프리픽스({@code uploads/dev})가 운영({@code uploads}) 안에 있어 위험해 보이는데,
     * 도메인 부분이 뒤에 붙어 최종 경로가 {@code uploads/posts/} 와 {@code uploads/dev/posts/}
     * 가 됩니다. 문자열로 한쪽이 다른 쪽의 접두사가 아니라 서로를 알아보지 못합니다.
     *
     * <p><b>다만 나중에 만들 청소 배치는 다릅니다.</b> 운영에서 {@code uploads/} 아래를 통째로
     * 훑으면 개발 객체까지 걸립니다. 그 배치를 만들 때는 개발 경로를 빼야 합니다.
     */
    @Test
    void prodCannotTouchDevObjectsEither() {
        S3ImageStorage prod = storageFor("uploads/posts");
        S3ImageStorage dev = storageFor("uploads/dev/posts");

        String devUrl = dev.save(pngFile());

        prod.delete(devUrl);

        assertThat(objectExists(keyOf(devUrl)))
                .as("운영 저장소가 개발 객체를 지우면 안 됩니다")
                .isTrue();
    }

    private S3ImageStorage storageFor(String prefix) {
        return new S3ImageStorage(
                client, BUCKET, prefix, prefix, PUBLIC_BASE_URL, CACHE_CONTROL,
                DataSize.ofMegabytes(5));
    }

    private String keyOf(String imageUrl) {
        return imageUrl.substring(PUBLIC_BASE_URL.length() + 1);
    }

    private GetObjectResponse headOf(String key) {
        try (ResponseInputStream<GetObjectResponse> object = client.getObject(
                GetObjectRequest.builder().bucket(BUCKET).key(key).build())) {
            return object.response();
        } catch (Exception exception) {
            throw new IllegalStateException("cannot read " + key, exception);
        }
    }

    private boolean objectExists(String key) {
        try {
            client.headObject(builder -> builder.bucket(BUCKET).key(key));
            return true;
        } catch (NoSuchKeyException exception) {
            return false;
        }
    }

    private MockMultipartFile pngFile() {
        return new MockMultipartFile("file", "photo.png", MediaType.IMAGE_PNG_VALUE, pngBytes());
    }

    private static byte[] pngBytes() {
        byte[] signature = {(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A};
        byte[] content = new byte[64];
        System.arraycopy(signature, 0, content, 0, signature.length);
        Arrays.fill(content, signature.length, content.length, (byte) 0x01);
        return content;
    }
}
