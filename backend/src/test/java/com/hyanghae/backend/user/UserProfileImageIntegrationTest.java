package com.hyanghae.backend.user;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hyanghae.backend.global.security.CurrentUser;
import com.hyanghae.backend.support.IntegrationTest;
import com.hyanghae.backend.user.exception.UserErrorCode;
import com.hyanghae.backend.user.service.UserProfileImageService;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.Comparator;
import java.util.Optional;
import java.util.stream.Stream;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * 프로필 사진 올리기·바꾸기·내리기를 실제 파일 시스템 위에서 검증합니다.
 *
 * <p>게시글 이미지와 다른 점이 둘입니다. <b>올리는 즉시 계정에 붙고</b>, <b>쓰던 사진의 파일이
 * 지워집니다.</b> 둘 다 단위 테스트로는 확인할 수 없습니다.
 */
@IntegrationTest
@AutoConfigureMockMvc
@ActiveProfiles({"manual-test", "test"})
class UserProfileImageIntegrationTest {

    private static final String PROFILE_IMAGE_URL = "/api/v1/users/me/profile-image";
    private static final String SERVE_PREFIX = "/api/v1/users/profile-images";

    private static final long USER_ID = 1;

    /**
     * {@code @TempDir} 대신 직접 만듭니다. 저장 위치는 스프링 컨텍스트가 만들어질 때 이미
     * 정해져 있어야 하는데, JUnit 이 정적 {@code @TempDir} 을 채우는 시점과의 순서가 보장되지
     * 않습니다.
     */
    private static final Path IMAGE_ROOT = createTempRoot();

    @DynamicPropertySource
    static void imageDirectory(DynamicPropertyRegistry registry) {
        registry.add("hyanghae.user.profile-image.directory", IMAGE_ROOT::toString);
    }

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private FakeCurrentUser currentUser;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private UserProfileImageService profileImageService;

    @Autowired
    private PlatformTransactionManager transactionManager;

    @BeforeEach
    void login() {
        jdbcTemplate.update("DELETE FROM users");
        jdbcTemplate.update(
                "INSERT INTO users (user_id, email, password_hash, nickname) VALUES (?, ?, ?, ?)",
                USER_ID, "me@hyanghae.test", "x", "나");
        currentUser.login(USER_ID);
    }

    @AfterEach
    void logout() {
        currentUser.logout();
        jdbcTemplate.update("DELETE FROM users");
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
     * 올리는 즉시 계정에 붙습니다. 내 정보를 다시 조회하면 그 주소가 나오고, 그 주소로 사진을
     * 받을 수 있어야 합니다.
     */
    @Test
    void uploadAppliesTheImageToTheAccountImmediately() throws Exception {
        byte[] content = png();

        String imageUrl = upload(content);

        assertThat(imageUrl).startsWith(SERVE_PREFIX + "/");

        mockMvc.perform(get("/api/v1/users/me"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.profileImageUrl").value(imageUrl));

        byte[] served = mockMvc.perform(get(imageUrl))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsByteArray();

        assertThat(served).isEqualTo(content);
    }

    /**
     * 프로필 사진은 글과 댓글 옆에 붙어 비회원에게도 보이는 자리입니다. 로그인 없이 받을 수
     * 없으면 비회원 화면에서 전부 깨집니다.
     */
    @Test
    void servesProfileImageWithoutLogin() throws Exception {
        String imageUrl = upload(png());

        currentUser.logout();

        mockMvc.perform(get(imageUrl)).andExpect(status().isOk());
    }

    /**
     * 사진을 바꾸면 쓰던 파일이 지워집니다. 남겨 두면 바꿀 때마다 디스크에 쌓입니다.
     */
    @Test
    void deletesTheOldFileWhenTheImageIsReplaced() throws Exception {
        String oldUrl = upload(png());
        assertThat(storedFile(oldUrl)).exists();

        String newUrl = upload(png());

        assertThat(newUrl).isNotEqualTo(oldUrl);
        assertThat(storedFile(oldUrl)).doesNotExist();
        assertThat(storedFile(newUrl)).exists();
    }

    /**
     * 내리면 파일도 지우고 컬럼도 비웁니다. 화면은 다시 기본 아바타를 보여줍니다.
     */
    @Test
    void removesImageAndFile() throws Exception {
        String imageUrl = upload(png());

        mockMvc.perform(delete(PROFILE_IMAGE_URL))
                .andExpect(status().isNoContent());

        assertThat(storedFile(imageUrl)).doesNotExist();

        mockMvc.perform(get("/api/v1/users/me"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.profileImageUrl").doesNotExist());
    }

    /**
     * 사진이 없을 때 내려도 오류가 아닙니다. 여러 번 눌러도 결과가 같아야 합니다.
     */
    @Test
    void removingWithoutAnImageSucceeds() throws Exception {
        mockMvc.perform(delete(PROFILE_IMAGE_URL)).andExpect(status().isNoContent());
        mockMvc.perform(delete(PROFILE_IMAGE_URL)).andExpect(status().isNoContent());
    }

    /**
     * 이름과 {@code Content-Type} 만 이미지인 HTML 이 통과하면 우리 도메인에서 스크립트가
     * 실행됩니다. 에러 코드는 게시글이 아니라 <b>회원 도메인</b>의 것이어야 합니다.
     */
    @Test
    void rejectsHtmlDisguisedAsImageWithUserErrorCode() throws Exception {
        byte[] html = "<html><script>alert(1)</script></html>".getBytes(StandardCharsets.UTF_8);

        mockMvc.perform(multipart(PROFILE_IMAGE_URL)
                        .file(new MockMultipartFile("file", "avatar.png",
                                MediaType.IMAGE_PNG_VALUE, html)))
                .andExpect(status().isUnsupportedMediaType())
                .andExpect(jsonPath("$.code")
                        .value(UserErrorCode.USER_PROFILE_IMAGE_TYPE_NOT_ALLOWED.code()));
    }

    /**
     * 프로필의 기본 제한은 1MB 입니다. 게시글(5MB)보다 작으므로, 게시글이면 통과했을 크기가
     * 여기서는 거절돼야 합니다.
     */
    @Test
    void rejectsFileOverTheSmallerProfileLimit() throws Exception {
        byte[] signature = png();
        byte[] tooLarge = new byte[2 * 1024 * 1024];
        System.arraycopy(signature, 0, tooLarge, 0, signature.length);

        mockMvc.perform(multipart(PROFILE_IMAGE_URL)
                        .file(new MockMultipartFile("file", "avatar.png",
                                MediaType.IMAGE_PNG_VALUE, tooLarge)))
                .andExpect(status().isPayloadTooLarge())
                .andExpect(jsonPath("$.code")
                        .value(UserErrorCode.USER_PROFILE_IMAGE_TOO_LARGE.code()));
    }

    @Test
    void rejectsAnonymousUpload() throws Exception {
        currentUser.logout();

        mockMvc.perform(multipart(PROFILE_IMAGE_URL)
                        .file(new MockMultipartFile("file", "avatar.png",
                                MediaType.IMAGE_PNG_VALUE, png())))
                .andExpect(status().isUnauthorized());
    }

    /**
     * <b>트랜잭션이 롤백되면 쓰던 사진 파일이 살아 있어야 합니다.</b>
     *
     * <p>파일 삭제를 트랜잭션 안에서 하면 여기서 사고가 납니다 — 컬럼은 롤백되어 옛 주소를
     * 가리키는데 그 파일은 이미 지워져, 사용자의 프로필 사진이 통째로 깨집니다. 커밋된 뒤에만
     * 지우는 설계가 실제로 그것을 막는지 확인합니다.
     *
     * <p>새로 올린 파일은 남습니다(고아). 파일이 남는 것은 나중에 치울 수 있지만 쓰던 사진이
     * 사라지는 것은 되돌릴 수 없어, 둘 중 되돌릴 수 있는 쪽을 택한 결과입니다.
     */
    @Test
    void keepsTheOldFileWhenTheTransactionRollsBack() {
        String oldUrl = new TransactionTemplate(transactionManager)
                .execute(status -> profileImageService.upload(imageFile(png())));

        byte[] newContent = png();
        newContent[newContent.length - 1] = 0x02;

        String newUrl = new TransactionTemplate(transactionManager).execute(status -> {
            String uploaded = profileImageService.upload(imageFile(newContent));
            status.setRollbackOnly();
            return uploaded;
        });

        assertThat(storedFile(oldUrl))
                .as("롤백됐으므로 쓰던 사진은 지워지지 않아야 합니다")
                .exists();
        assertThat(storedFile(newUrl))
                .as("새로 올린 파일은 고아로 남습니다 — 문서에 적은 한계입니다")
                .exists();
        assertThat(jdbcTemplate.queryForObject(
                "SELECT profile_image_url FROM users WHERE user_id = ?", String.class, USER_ID))
                .as("컬럼도 롤백되어 옛 주소를 가리켜야 합니다")
                .isEqualTo(oldUrl);
    }

    private MockMultipartFile imageFile(byte[] content) {
        return new MockMultipartFile("file", "avatar.png", MediaType.IMAGE_PNG_VALUE, content);
    }

    /**
     * 탈퇴하면 그 사진을 가리키는 곳이 없습니다. 파일도 함께 지워야 합니다.
     */
    @Test
    void deletesTheFileWhenTheUserWithdraws() throws Exception {
        String imageUrl = upload(png());

        // 탈퇴는 비밀번호를 확인하므로 실제로 검증되는 해시를 넣어 둡니다.
        jdbcTemplate.update("UPDATE users SET password_hash = ? WHERE user_id = ?",
                passwordEncoder(), USER_ID);

        mockMvc.perform(delete("/api/v1/users/me")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"password\":\"Test1234!\"}"))
                .andExpect(status().isNoContent());

        assertThat(storedFile(imageUrl)).doesNotExist();
    }

    private String upload(byte[] content) throws Exception {
        String body = mockMvc.perform(multipart(PROFILE_IMAGE_URL)
                        .file(new MockMultipartFile("file", "avatar.png",
                                MediaType.IMAGE_PNG_VALUE, content)))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString(StandardCharsets.UTF_8);

        return objectMapper.readTree(body).get("profileImageUrl").asText();
    }

    private Path storedFile(String imageUrl) {
        return IMAGE_ROOT.resolve(imageUrl.substring(SERVE_PREFIX.length() + 1));
    }

    private String passwordEncoder() {
        return new org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder()
                .encode("Test1234!");
    }

    /**
     * 시그니처만 맞으면 됩니다. 저장 코드는 파일 앞부분만 읽어 형식을 정하고 나머지는 그대로
     * 저장하므로, 검증을 위해 진짜 그림을 만들 필요가 없습니다. 내용이 매번 달라야 바꿔치기가
     * 실제로 일어났는지 확인할 수 있어 끝에 임의 값을 섞습니다.
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
            return Files.createTempDirectory("hyanghae-profile-images");
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
