package com.hyanghae.backend.community;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.head;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hyanghae.backend.community.exception.CommunityErrorCode;
import com.hyanghae.backend.global.security.CurrentUser;
import com.hyanghae.backend.support.IntegrationTest;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Stream;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;

/**
 * 게시글 이미지 업로드를 실제 파일 시스템 위에서 검증합니다.
 *
 * <p>가장 중요한 것은 <b>왕복</b>입니다. 올려서 받은 주소로 다시 받을 수 없으면 주소를 돌려준
 * 의미가 없습니다. 저장은 됐는데 내주는 경로가 어긋나는 실수는 단위 테스트로 잡히지 않습니다.
 *
 * <p>저장 위치는 임시 디렉터리로 바꿉니다. 그러지 않으면 테스트가 개발자의 작업 디렉터리에
 * 파일을 쌓고, 실행할 때마다 남습니다.
 */
@IntegrationTest
@AutoConfigureMockMvc
@ActiveProfiles({"manual-test", "test"})
@ExtendWith(OutputCaptureExtension.class)
class PostImageUploadIntegrationTest {

    private static final String UPLOAD_URL = "/api/v1/posts/images";

    private static final long UPLOADER_ID = 1;
    private static final long OTHER_USER_ID = 2;

    /**
     * {@code @TempDir} 대신 직접 만듭니다. 저장 위치는 스프링 컨텍스트가 만들어질 때 이미
     * 정해져 있어야 하는데, JUnit 이 정적 {@code @TempDir} 을 채우는 시점과의 순서가 보장되지
     * 않습니다.
     */
    private static final Path IMAGE_ROOT = createTempRoot();

    @DynamicPropertySource
    static void imageDirectory(DynamicPropertyRegistry registry) {
        registry.add("hyanghae.community.post-image.directory", IMAGE_ROOT::toString);
    }

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private FakeCurrentUser currentUser;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void login() {
        clearPosts();
        // posts.user_id 에 외래키가 걸려 있어 글을 쓰려면 사용자 행이 먼저 있어야 합니다.
        insertUser(UPLOADER_ID, "uploader@hyanghae.test", "올린이");
        insertUser(OTHER_USER_ID, "other@hyanghae.test", "다른 사람");
        currentUser.login(UPLOADER_ID);
    }

    @AfterEach
    void logout() {
        currentUser.logout();
        clearPosts();
    }

    private void clearPosts() {
        jdbcTemplate.update("DELETE FROM post_images");
        jdbcTemplate.update("DELETE FROM post_perfumes");
        jdbcTemplate.update("DELETE FROM posts");
        jdbcTemplate.update("DELETE FROM users");
    }

    private void insertUser(long id, String email, String nickname) {
        jdbcTemplate.update(
                "INSERT INTO users (user_id, email, password_hash, nickname) VALUES (?, ?, 'x', ?)",
                id, email, nickname);
    }

    @AfterAll
    static void deleteTempRoot() throws IOException {
        if (!Files.exists(IMAGE_ROOT)) {
            return;
        }
        try (Stream<Path> paths = Files.walk(IMAGE_ROOT)) {
            paths.sorted(Comparator.reverseOrder()).forEach(path -> {
                try {
                    Files.delete(path);
                } catch (IOException exception) {
                    throw new UncheckedIOException(exception);
                }
            });
        }
    }

    /**
     * 올린 이미지는 돌려받은 주소로 다시 받을 수 있어야 하고, 내용이 같아야 합니다.
     */
    @Test
    void uploadedImageIsServedBackAtTheReturnedUrl() throws Exception {
        byte[] content = png();

        String imageUrl = upload(new MockMultipartFile("file", "photo.png",
                MediaType.IMAGE_PNG_VALUE, content));

        assertThat(imageUrl).startsWith(UPLOAD_URL + "/");

        byte[] served = mockMvc.perform(get(imageUrl))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsByteArray();

        assertThat(served).isEqualTo(content);
    }

    /**
     * 파일 이름은 우리가 새로 짓습니다. 보낸 이름을 그대로 쓰면 같은 이름을 올린 다른 사람의
     * 파일을 덮어쓰고, 확장자로 형식을 속일 수 있습니다.
     */
    @Test
    void ignoresClientSuppliedFileNameAndExtension() throws Exception {
        String imageUrl = upload(new MockMultipartFile("file", "profile.jpeg",
                MediaType.IMAGE_JPEG_VALUE, png()));

        assertThat(imageUrl).endsWith(".png");
        assertThat(imageUrl).doesNotContain("profile");
    }

    /**
     * 같은 파일을 두 번 올리면 서로 다른 주소가 나와야 합니다. 이름을 내용에서 만들면 다른
     * 사람이 올린 같은 그림을 한 곳에 모으게 되고, 한 명이 지울 때 나머지가 함께 깨집니다.
     */
    @Test
    void givesEachUploadItsOwnUrl() throws Exception {
        byte[] content = png();

        String first = upload(new MockMultipartFile("file", "a.png",
                MediaType.IMAGE_PNG_VALUE, content));
        String second = upload(new MockMultipartFile("file", "a.png",
                MediaType.IMAGE_PNG_VALUE, content));

        assertThat(first).isNotEqualTo(second);
    }

    /**
     * <b>가장 중요한 거절입니다.</b> 이름과 {@code Content-Type} 만 이미지인 HTML 이 통과하면
     * 우리 도메인에서 스크립트가 실행됩니다.
     */
    @Test
    void rejectsHtmlDisguisedAsImage() throws Exception {
        byte[] html = "<html><script>alert(1)</script></html>".getBytes(StandardCharsets.UTF_8);

        mockMvc.perform(multipart(UPLOAD_URL)
                        .file(new MockMultipartFile("file", "photo.png",
                                MediaType.IMAGE_PNG_VALUE, html)))
                .andExpect(status().isUnsupportedMediaType())
                .andExpect(jsonPath("$.code")
                        .value(CommunityErrorCode.COMMUNITY_IMAGE_TYPE_NOT_ALLOWED.code()));
    }

    @Test
    void rejectsEmptyFile() throws Exception {
        mockMvc.perform(multipart(UPLOAD_URL)
                        .file(new MockMultipartFile("file", "empty.png",
                                MediaType.IMAGE_PNG_VALUE, new byte[0])))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code")
                        .value(CommunityErrorCode.COMMUNITY_IMAGE_EMPTY.code()));
    }

    /**
     * 기본 제한은 5MB 입니다. Spring 의 multipart 제한(8MB)보다 작아서, 그 사이 크기는
     * 애플리케이션이 먼저 잡아 이유가 있는 에러 코드로 돌려줍니다.
     */
    @Test
    void rejectsFileOverSizeLimit() throws Exception {
        byte[] signature = png();
        byte[] tooLarge = new byte[6 * 1024 * 1024];
        System.arraycopy(signature, 0, tooLarge, 0, signature.length);

        mockMvc.perform(multipart(UPLOAD_URL)
                        .file(new MockMultipartFile("file", "big.png",
                                MediaType.IMAGE_PNG_VALUE, tooLarge)))
                .andExpect(status().isPayloadTooLarge())
                .andExpect(jsonPath("$.code")
                        .value(CommunityErrorCode.COMMUNITY_IMAGE_TOO_LARGE.code()));
    }

    @Test
    void rejectsAnonymousUpload() throws Exception {
        currentUser.logout();

        mockMvc.perform(multipart(UPLOAD_URL)
                        .file(new MockMultipartFile("file", "photo.png",
                                MediaType.IMAGE_PNG_VALUE, png())))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code")
                        .value(CommunityErrorCode.COMMUNITY_LOGIN_REQUIRED.code()));
    }

    /**
     * 저장 기록은 남기되 사용자를 가리키는 값은 남기지 않아야 합니다.
     *
     * <p>누가 올렸는지는 같은 줄의 {@code requestId} 로 요청 로그를 찾으면 됩니다. 보낸 파일
     * 이름도 사용자가 적은 값이라 남기지 않습니다.
     */
    @Test
    void logsStoredImageWithoutIdentifyingValues(CapturedOutput output) throws Exception {
        upload(new MockMultipartFile("file", "my-private-photo.png",
                MediaType.IMAGE_PNG_VALUE, png()));

        assertThat(output).contains("Image stored");
        assertThat(output).contains("urlPath=" + UPLOAD_URL);
        assertThat(output).contains("format=PNG");
        assertThat(output).doesNotContain("userId");
        assertThat(output).doesNotContain("my-private-photo");
    }

    /**
     * 파일 자리를 비워 보내면 400 입니다.
     */
    @Test
    void rejectsRequestWithoutFilePart() throws Exception {
        mockMvc.perform(multipart(UPLOAD_URL))
                .andExpect(status().isBadRequest());
    }

    /**
     * HEAD 는 본문 없는 GET 입니다. 크기와 형식만 확인하려는 쪽(링크 미리보기 수집기, 캐시
     * 앞단)이 쓰므로 GET 이 열린 곳은 HEAD 도 열려 있어야 합니다.
     */
    @Test
    void servesHeadRequestsForImages() throws Exception {
        String imageUrl = upload(new MockMultipartFile("file", "photo.png",
                MediaType.IMAGE_PNG_VALUE, png()));

        mockMvc.perform(head(imageUrl))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Type", MediaType.IMAGE_PNG_VALUE));
    }

    /**
     * 글을 지우면 그 글이 쓰던 파일도 지워집니다. 행만 지우면 파일이 디스크에 영영 남습니다.
     */
    @Test
    void deletesImageFileWhenPostIsDeleted() throws Exception {
        String imageUrl = upload(new MockMultipartFile("file", "photo.png",
                MediaType.IMAGE_PNG_VALUE, png()));
        long postId = writePost(List.of(imageUrl));

        assertThat(storedFile(imageUrl)).exists();

        mockMvc.perform(delete("/api/v1/posts/{postId}", postId))
                .andExpect(status().isNoContent());

        assertThat(storedFile(imageUrl)).doesNotExist();
    }

    /**
     * <b>다른 글이 같은 주소를 쓰고 있으면 파일을 남깁니다.</b>
     *
     * <p>주소는 문자열이라 남의 글에 있는 주소를 복사해 자기 글에 붙일 수 있습니다. 세어 보지
     * 않고 지우면 자기 글을 지우는 것만으로 남의 글 이미지를 깨뜨릴 수 있습니다.
     */
    @Test
    void keepsImageFileWhileAnotherPostStillUsesIt() throws Exception {
        String imageUrl = upload(new MockMultipartFile("file", "photo.png",
                MediaType.IMAGE_PNG_VALUE, png()));
        long mine = writePost(List.of(imageUrl));

        currentUser.login(OTHER_USER_ID);
        long theirs = writePost(List.of(imageUrl));

        currentUser.login(UPLOADER_ID);
        mockMvc.perform(delete("/api/v1/posts/{postId}", mine))
                .andExpect(status().isNoContent());

        assertThat(storedFile(imageUrl)).exists();
        // 파일이 남아 있는 것만으로는 부족합니다. 남은 글을 보는 사람에게 이미지가 실제로
        // 내려가야 합니다.
        mockMvc.perform(get(imageUrl)).andExpect(status().isOk());

        currentUser.login(OTHER_USER_ID);
        mockMvc.perform(delete("/api/v1/posts/{postId}", theirs))
                .andExpect(status().isNoContent());

        assertThat(storedFile(imageUrl)).doesNotExist();
    }

    /**
     * 이미지를 교체하면 빠진 파일만 지우고 그대로 남는 파일은 건드리지 않습니다.
     */
    @Test
    void deletesOnlyTheImagesDroppedByAnUpdate() throws Exception {
        String kept = upload(new MockMultipartFile("file", "kept.png",
                MediaType.IMAGE_PNG_VALUE, png()));
        String dropped = upload(new MockMultipartFile("file", "dropped.png",
                MediaType.IMAGE_PNG_VALUE, png()));
        long postId = writePost(List.of(kept, dropped));

        mockMvc.perform(patch("/api/v1/posts/{postId}", postId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"imageUrls\":[\"" + kept + "\"]}"))
                .andExpect(status().isOk());

        assertThat(storedFile(kept)).exists();
        assertThat(storedFile(dropped)).doesNotExist();
    }

    /**
     * 우리가 만들지 않은 주소가 글에 들어 있어도 조용히 지나가야 합니다.
     *
     * <p>{@code imageUrls} 는 문자열이라 외부 주소나 {@code ../} 가 섞인 주소가 들어올 수
     * 있습니다. 그 주소로 디스크를 건드리면 글을 지우는 것만으로 서버의 다른 파일을 지울 수
     * 있습니다.
     */
    @Test
    void ignoresImageUrlsItDidNotStore() throws Exception {
        Path outsider = IMAGE_ROOT.getParent().resolve("outsider-" + UUID.randomUUID() + ".png");
        Files.write(outsider, png());
        try {
            long postId = writePost(List.of(
                    "https://example.test/photo.png",
                    UPLOAD_URL + "/../" + outsider.getFileName()));

            mockMvc.perform(delete("/api/v1/posts/{postId}", postId))
                    .andExpect(status().isNoContent());

            assertThat(outsider).exists();
        } finally {
            Files.deleteIfExists(outsider);
        }
    }

    /**
     * 저장 위치를 벗어나는 주소로는 아무것도 내주지 않아야 합니다. 이 경로가 열리면 서버의
     * 어떤 파일이든 읽을 수 있습니다.
     *
     * <p>막는 곳이 둘입니다. Spring Security 의 {@code StrictHttpFirewall} 이 {@code ..} 가
     * 들어간 요청을 라우팅 전에 400 으로 끊고, 그것을 지나더라도 리소스 핸들러가 저장 위치
     * 밖의 파일은 찾아 주지 않습니다. 여기서 확인하는 것은 앞쪽이라 404 가 아니라 400 입니다.
     */
    @Test
    void doesNotServeFilesOutsideTheImageDirectory() throws Exception {
        mockMvc.perform(get(UPLOAD_URL + "/../../../../etc/passwd"))
                .andExpect(status().isBadRequest());
    }

    /**
     * 글을 하나 씁니다. 이미지 주소를 붙이는 것 말고는 이 테스트가 신경 쓸 값이 없어
     * 분류·제목·본문은 고정합니다.
     */
    private long writePost(List<String> imageUrls) throws Exception {
        String body = objectMapper.writeValueAsString(Map.of(
                "category", "CHAT",
                "title", "이미지 있는 글",
                "content", "본문입니다.",
                "imageUrls", imageUrls
        ));

        String response = mockMvc.perform(post("/api/v1/posts")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString(StandardCharsets.UTF_8);

        return objectMapper.readTree(response).get("postId").asLong();
    }

    /**
     * 주소가 가리키는 실제 파일입니다. 저장 위치는 임시 디렉터리로 바꿔 두었습니다.
     */
    private Path storedFile(String imageUrl) {
        return IMAGE_ROOT.resolve(imageUrl.substring(UPLOAD_URL.length() + 1));
    }

    private String upload(MockMultipartFile file) throws Exception {
        String body = mockMvc.perform(multipart(UPLOAD_URL).file(file))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString(StandardCharsets.UTF_8);

        return objectMapper.readTree(body).get("imageUrl").asText();
    }

    /**
     * 시그니처만 맞으면 됩니다. 이 코드는 파일 앞부분만 읽어 형식을 정하고 나머지는 그대로
     * 저장하므로, 검증을 위해 진짜 그림을 만들 필요가 없습니다.
     */
    private byte[] png() {
        byte[] signature = {(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A};
        byte[] content = new byte[32];
        System.arraycopy(signature, 0, content, 0, signature.length);
        Arrays.fill(content, signature.length, content.length, (byte) 0x01);
        return content;
    }

    private static Path createTempRoot() {
        try {
            return Files.createTempDirectory("hyanghae-post-images");
        } catch (IOException exception) {
            throw new UncheckedIOException(exception);
        }
    }

    @TestConfiguration
    static class FakeCurrentUserConfig {

        @Bean
        @Primary
        FakeCurrentUser fakeCurrentUser() {
            return new FakeCurrentUser();
        }
    }

    static class FakeCurrentUser implements CurrentUser {

        private Long id;

        void login(Long id) {
            this.id = id;
        }

        void logout() {
            this.id = null;
        }

        @Override
        public Optional<Long> id() {
            return Optional.ofNullable(id);
        }
    }
}
