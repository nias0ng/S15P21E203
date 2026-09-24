package com.hyanghae.backend.community;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hyanghae.backend.community.exception.CommunityErrorCode;
import com.hyanghae.backend.global.security.CurrentUser;
import com.hyanghae.backend.support.IntegrationTest;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.hamcrest.Matchers;
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
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

/**
 * 자유 게시판 글의 CRUD 를 실제 PostgreSQL 위에서 검증합니다.
 *
 * <p>인증이 아직 없어 {@link CurrentUser} 를 대역으로 바꿔 로그인한 경우를 만듭니다.
 *
 * <p>분류 셋은 마이그레이션이 심어 둔 것을 그대로 씁니다. 번호가 아니라 코드로 주고받으므로
 * 테스트도 코드만 씁니다.
 */
@IntegrationTest
@AutoConfigureMockMvc
@ActiveProfiles({"manual-test", "test"})
class PostIntegrationTest {

    private static final String POSTS_URL = "/api/v1/posts";
    private static final String POST_URL = "/api/v1/posts/{postId}";
    private static final String LIKE_URL = "/api/v1/posts/{postId}/like";

    private static final long WRITER_ID = 1;
    private static final long OTHER_WRITER_ID = 2;

    private static final long MY_COLLECTION_ID = 1;
    private static final long OTHER_COLLECTION_ID = 2;
    private static final long MISSING_COLLECTION_ID = 999;

    private static final String PROFILE_IMAGE_URL =
            "/api/v1/users/profile-images/2026/09/0a1b2c3d-4e5f-6071-8293-a4b5c6d7e8f9.jpg";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private FakeCurrentUser currentUser;

    @BeforeEach
    void insertFixtures() {
        clearData();

        insertUser(WRITER_ID, "writer@hyanghae.test", "글쓴이");
        insertUser(OTHER_WRITER_ID, "other@hyanghae.test", "다른 사람");

        insertBrand(1, "Chanel");
        insertPerfume(1, "Base Scent", true);
        insertPerfume(2, "Second Scent", true);
        insertPerfume(3, "Retired Scent", false);

        insertCollection(MY_COLLECTION_ID, WRITER_ID, "내 컬렉션");
        insertCollection(OTHER_COLLECTION_ID, OTHER_WRITER_ID, "남의 컬렉션");

        currentUser.login(WRITER_ID);
    }

    @AfterEach
    void cleanUp() {
        currentUser.logout();
        clearData();
    }

    /**
     * 글을 쓰면 향수와 이미지가 보낸 순서대로 걸립니다.
     *
     * <p>순서를 지키지 않으면 화면이 고른 대표 이미지가 매번 달라집니다.
     */
    @Test
    void writesPostWithPerfumesAndImagesInOrder() throws Exception {
        long postId = write("CHAT", "첫 글", "본문입니다.",
                List.of(2L, 1L), List.of("second.jpg", "first.jpg"));

        mockMvc.perform(get(POST_URL, postId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("첫 글"))
                .andExpect(jsonPath("$.content").value("본문입니다."))
                .andExpect(jsonPath("$.nickname").value("글쓴이"))
                .andExpect(jsonPath("$.category").value("CHAT"))
                .andExpect(jsonPath("$.imageUrls")
                        .value(Matchers.contains("second.jpg", "first.jpg")))
                .andExpect(jsonPath("$.relatedPerfumes[*].perfumeId")
                        .value(Matchers.contains(2, 1)))
                .andExpect(jsonPath("$.relatedPerfumes[0].name").value("Second Scent"))
                .andExpect(jsonPath("$.relatedPerfumes[0].brand").value("Chanel"))
                .andExpect(jsonPath("$.createdAt").isNotEmpty())
                .andExpect(jsonPath("$.updatedAt").isNotEmpty());
    }

    /**
     * 목록과 상세에 작성자 프로필 사진 주소가 함께 실립니다.
     *
     * <p>남의 프로필을 따로 조회할 길이 없어, 여기서 주지 않으면 화면이 작성자 아바타 자리를 비운
     * 채 둬야 합니다. 값 규칙은 {@code /users/me} 와 같습니다 — 사진을 설정하지 않았으면
     * {@code null} 이고 화면이 기본 아바타를 보여줍니다.
     */
    @Test
    void putsTheAuthorProfileImageInListAndDetail() throws Exception {
        long postId = write("CHAT", "사진 있는 사람의 글", "본문", null, null);

        mockMvc.perform(get(POSTS_URL))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.posts[0].profileImageUrl").doesNotExist());

        jdbcTemplate.update("UPDATE users SET profile_image_url = ? WHERE user_id = ?",
                PROFILE_IMAGE_URL, WRITER_ID);

        mockMvc.perform(get(POSTS_URL))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.posts[0].nickname").value("글쓴이"))
                .andExpect(jsonPath("$.posts[0].profileImageUrl").value(PROFILE_IMAGE_URL));

        mockMvc.perform(get(POST_URL, postId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.nickname").value("글쓴이"))
                .andExpect(jsonPath("$.profileImageUrl").value(PROFILE_IMAGE_URL));
    }

    /** 향수도 이미지도 없는 글을 쓸 수 있습니다. 자유 게시판 글은 향수를 걸지 않을 수 있습니다. */
    @Test
    void writesPostWithoutPerfumesOrImages() throws Exception {
        long postId = write("CHAT", "혼잣말", "향수 없이 씁니다.", null, null);

        mockMvc.perform(get(POST_URL, postId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.imageUrls").isEmpty())
                .andExpect(jsonPath("$.relatedPerfumes").isEmpty());
    }

    /**
     * 목록은 최신순이고 분류로 거를 수 있습니다.
     *
     * <p>분류를 주지 않으면 전체입니다. 총 개수는 거른 범위와 같은 기준으로 셉니다.
     */
    @Test
    void listsPostsByCategoryInLatestOrder() throws Exception {
        write("CHAT", "첫 번째", "본문", null, null);
        write("RECOMMEND", "두 번째", "본문", null, null);
        write("CHAT", "세 번째", "본문", null, null);

        mockMvc.perform(get(POSTS_URL))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(3))
                .andExpect(jsonPath("$.page").value(0))
                .andExpect(jsonPath("$.size").value(20))
                .andExpect(jsonPath("$.posts[*].title")
                        .value(Matchers.contains("세 번째", "두 번째", "첫 번째")))
                .andExpect(jsonPath("$.posts[0].nickname").value("글쓴이"));

        mockMvc.perform(get(POSTS_URL).param("category", "CHAT"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(2))
                .andExpect(jsonPath("$.posts[*].title")
                        .value(Matchers.contains("세 번째", "첫 번째")));
    }

    /**
     * 목록 한 줄에 분류 코드와 대표 향수가 실립니다.
     *
     * <p>대표는 <b>먼저 걸어 둔 향수</b>입니다. 화면이 매번 하나를 고르지 않도록 서버가 정합니다.
     * 향수를 걸지 않은 글은 비어 있습니다.
     */
    @Test
    void putsCategoryAndRepresentativePerfumeInEachRow() throws Exception {
        write("COLLECTION", "향수 건 글", "본문", List.of(2L, 1L), null);
        write("CHAT", "향수 없는 글", "본문", null, null);

        mockMvc.perform(get(POSTS_URL))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.posts[0].category").value("CHAT"))
                .andExpect(jsonPath("$.posts[0].perfume").doesNotExist())
                .andExpect(jsonPath("$.posts[1].category").value("COLLECTION"))
                .andExpect(jsonPath("$.posts[1].perfume.perfumeId").value(2))
                .andExpect(jsonPath("$.posts[1].perfume.name").value("Second Scent"))
                .andExpect(jsonPath("$.posts[1].perfume.brand").value("Chanel"));
    }

    /**
     * 목록과 상세에 댓글 수가 실립니다.
     *
     * <p>화면이 한 줄마다 "댓글 N" 을 그립니다. 댓글을 지우면 수도 함께 줄어야 합니다.
     */
    @Test
    void countsComments() throws Exception {
        long postId = write("CHAT", "댓글 달린 글", "본문", null, null);
        writeComment(postId, "첫 댓글");
        writeComment(postId, "둘째 댓글");
        long removed = writeComment(postId, "지울 댓글");

        mockMvc.perform(get(POSTS_URL))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.posts[0].commentCount").value(3));

        jdbcTemplate.update("DELETE FROM comments WHERE comment_id = ?", removed);

        mockMvc.perform(get(POSTS_URL))
                .andExpect(jsonPath("$.posts[0].commentCount").value(2));

        mockMvc.perform(get(POST_URL, postId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.commentCount").value(2));
    }

    /**
     * 댓글 많은 순으로도 볼 수 있습니다.
     *
     * <p>댓글 수가 같으면 최신순으로 갈립니다. 첫 기준만 두면 같은 글이 두 페이지에 나오거나
     * 어떤 글이 아예 빠집니다.
     */
    @Test
    void sortsByCommentCount() throws Exception {
        long few = write("CHAT", "댓글 하나", "본문", null, null);
        long many = write("CHAT", "댓글 셋", "본문", null, null);
        long none = write("CHAT", "댓글 없음", "본문", null, null);

        writeComment(few, "하나");
        writeComment(many, "하나");
        writeComment(many, "둘");
        writeComment(many, "셋");

        mockMvc.perform(get(POSTS_URL).param("sort", "COMMENTS"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.posts[*].title")
                        .value(Matchers.contains("댓글 셋", "댓글 하나", "댓글 없음")));

        mockMvc.perform(get(POSTS_URL))
                .andExpect(jsonPath("$.posts[*].title")
                        .value(Matchers.contains("댓글 없음", "댓글 셋", "댓글 하나")));

        assertThat(none).isPositive();
    }

    /**
     * 댓글 수가 모두 같아도 페이지를 넘길 때 겹치거나 빠지는 글이 없습니다.
     *
     * <p>정렬의 첫 기준만 두면 같은 값끼리의 순서를 데이터베이스가 그때그때 정합니다. 그러면
     * 1페이지에 나온 글이 2페이지에 또 나오고 어떤 글은 아예 안 보입니다. 최신순과 글 번호까지
     * 이어 붙여 순서를 확정한 이유입니다.
     */
    @Test
    void keepsOrderStableWhenCommentCountsTie() throws Exception {
        List<String> titles = List.of("하나", "둘", "셋", "넷", "다섯");
        for (String title : titles) {
            long postId = write("CHAT", title, "본문", null, null);
            writeComment(postId, "댓글 하나씩");
        }

        List<String> seen = new ArrayList<>();
        for (int page = 0; page < 3; page++) {
            String body = mockMvc.perform(get(POSTS_URL)
                            .param("sort", "COMMENTS")
                            .param("size", "2")
                            .param("page", String.valueOf(page)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.posts[*].commentCount")
                            .value(Matchers.everyItem(Matchers.is(1))))
                    .andReturn()
                    .getResponse()
                    .getContentAsString();

            objectMapper.readTree(body).get("posts")
                    .forEach(post -> seen.add(post.get("title").asText()));
        }

        assertThat(seen).doesNotHaveDuplicates();
        assertThat(seen).containsExactlyInAnyOrderElementsOf(titles);
    }

    /** 네 가지 정렬은 모두 받습니다. 화면의 정렬 칩과 하나씩 맞습니다. */
    @Test
    void acceptsEverySort() throws Exception {
        for (String sort : new String[]{"RECENT", "VIEWS", "LIKES", "COMMENTS"}) {
            mockMvc.perform(get(POSTS_URL).param("sort", sort))
                    .andExpect(status().isOk());
        }
    }

    /** 목록에 없는 정렬 기준은 400 입니다. Spring 이 값을 못 바꿔 서비스까지 오지 않습니다. */
    @Test
    void rejectsUnknownSort() throws Exception {
        mockMvc.perform(get(POSTS_URL).param("sort", "OLDEST"))
                .andExpect(status().isBadRequest());
    }

    /**
     * 컬렉션 공유 글에 내 컬렉션을 붙입니다.
     *
     * <p>상세에 번호와 이름이 함께 나갑니다. 이름만 주면 화면이 컬렉션 상세로 넘어갈 수 없습니다.
     */
    @Test
    void attachesMyCollection() throws Exception {
        long postId = writeWithCollection("COLLECTION", "컬렉션 공유 글", MY_COLLECTION_ID);

        mockMvc.perform(get(POST_URL, postId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.collectionId").value(MY_COLLECTION_ID))
                .andExpect(jsonPath("$.collectionTitle").value("내 컬렉션"));
    }

    /** 첨부하지 않은 글은 둘 다 비어 나갑니다. */
    @Test
    void leavesCollectionEmptyWhenNotAttached() throws Exception {
        long postId = write("CHAT", "그냥 글", "본문", null, null);

        mockMvc.perform(get(POST_URL, postId))
                .andExpect(jsonPath("$.collectionId").doesNotExist())
                .andExpect(jsonPath("$.collectionTitle").doesNotExist());
    }

    /**
     * 없는 컬렉션과 남의 컬렉션은 같은 404 입니다.
     *
     * <p>컬렉션은 누구나 볼 수 있는 자료가 아니라 존재를 숨기는 편이 맞습니다. 남의 글을 403 으로
     * 답하는 것과 반대 이유입니다.
     */
    @Test
    void rejectsCollectionThatIsNotMine() throws Exception {
        for (long collectionId : new long[]{MISSING_COLLECTION_ID, OTHER_COLLECTION_ID}) {
            mockMvc.perform(post(POSTS_URL)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(collectionBody("COLLECTION", "가로채기", collectionId)))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.code")
                            .value(CommunityErrorCode.COMMUNITY_COLLECTION_NOT_FOUND.code()));
        }

        assertThat(countRows("posts")).isZero();
    }

    /**
     * 수정으로도 남의 컬렉션을 붙일 수 없습니다.
     *
     * <p>작성만 막으면 글을 쓴 뒤 수정으로 붙이는 길이 열립니다. 두 경로가 같은 규칙을 봐야
     * 합니다.
     */
    @Test
    void rejectsAttachingSomeoneElsesCollectionOnUpdate() throws Exception {
        long postId = write("COLLECTION", "공유 글", "본문", null, null);

        for (long collectionId : new long[]{MISSING_COLLECTION_ID, OTHER_COLLECTION_ID}) {
            mockMvc.perform(patch(POST_URL, postId)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"collectionId\": " + collectionId + "}"))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.code")
                            .value(CommunityErrorCode.COMMUNITY_COLLECTION_NOT_FOUND.code()));
        }

        mockMvc.perform(get(POST_URL, postId))
                .andExpect(jsonPath("$.collectionId").doesNotExist());
    }

    /** 수정으로 첨부를 바꾸거나 뗄 수 있습니다. null 을 보내면 뗍니다. */
    @Test
    void changesAndDetachesCollection() throws Exception {
        long postId = write("COLLECTION", "공유 글", "본문", null, null);

        mockMvc.perform(patch(POST_URL, postId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"collectionId\": " + MY_COLLECTION_ID + "}"))
                .andExpect(status().isOk());
        mockMvc.perform(get(POST_URL, postId))
                .andExpect(jsonPath("$.collectionTitle").value("내 컬렉션"));

        mockMvc.perform(patch(POST_URL, postId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"collectionId\": null}"))
                .andExpect(status().isOk());
        mockMvc.perform(get(POST_URL, postId))
                .andExpect(jsonPath("$.collectionId").doesNotExist());
    }

    /**
     * 컬렉션을 지워도 글은 남고 첨부만 떨어집니다.
     *
     * <p>컬렉션을 정리했다고 그것을 소개한 글까지 사라지면 안 됩니다.
     */
    @Test
    void keepsPostWhenTheCollectionIsDeleted() throws Exception {
        long postId = writeWithCollection("COLLECTION", "공유 글", MY_COLLECTION_ID);

        jdbcTemplate.update("DELETE FROM collections WHERE collection_id = ?", MY_COLLECTION_ID);

        mockMvc.perform(get(POST_URL, postId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("공유 글"))
                .andExpect(jsonPath("$.collectionId").doesNotExist());
    }

    /** 페이지 크기는 1~100 으로 자릅니다. 총 개수는 자른 것과 무관하게 전체입니다. */
    @Test
    void clampsPageSize() throws Exception {
        write("CHAT", "하나", "본문", null, null);
        write("CHAT", "둘", "본문", null, null);

        mockMvc.perform(get(POSTS_URL).param("size", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.posts.length()").value(1))
                .andExpect(jsonPath("$.totalElements").value(2));

        mockMvc.perform(get(POSTS_URL).param("size", "500"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.size").value(100));
    }

    /**
     * 보낸 항목만 바뀌고 나머지는 그대로입니다.
     *
     * <p>제목만 보내면 내용과 분류, 향수 연결이 그대로 남아야 합니다. 부분 수정이 아니면 화면이
     * 매번 글 전체를 다시 보내야 합니다.
     */
    @Test
    void updatesOnlyWhatWasSent() throws Exception {
        long postId = write("CHAT", "원래 제목", "원래 본문",
                List.of(1L), List.of("first.jpg"));

        mockMvc.perform(patch(POST_URL, postId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\": \"고친 제목\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.postId").value(postId))
                .andExpect(jsonPath("$.updatedAt").isNotEmpty());

        mockMvc.perform(get(POST_URL, postId))
                .andExpect(jsonPath("$.title").value("고친 제목"))
                .andExpect(jsonPath("$.content").value("원래 본문"))
                .andExpect(jsonPath("$.category").value("CHAT"))
                .andExpect(jsonPath("$.relatedPerfumes[*].perfumeId")
                        .value(Matchers.contains(1)))
                .andExpect(jsonPath("$.imageUrls").value(Matchers.contains("first.jpg")));
    }

    /** 분류를 코드로 바꿀 수 있습니다. */
    @Test
    void changesCategoryByCode() throws Exception {
        long postId = write("CHAT", "제목", "본문", null, null);

        mockMvc.perform(patch(POST_URL, postId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"category\": \"RECOMMEND\"}"))
                .andExpect(status().isOk());

        mockMvc.perform(get(POST_URL, postId))
                .andExpect(jsonPath("$.category").value("RECOMMEND"));
    }

    /** 빈 배열을 보내면 연결이 모두 지워집니다. 목록을 통째로 바꾸는 방식이라 가능한 동작입니다. */
    @Test
    void clearsLinksWithEmptyArrays() throws Exception {
        long postId = write("CHAT", "제목", "본문", List.of(1L, 2L), List.of("a.jpg"));

        mockMvc.perform(patch(POST_URL, postId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"perfumeIds\": [], \"imageUrls\": []}"))
                .andExpect(status().isOk());

        mockMvc.perform(get(POST_URL, postId))
                .andExpect(jsonPath("$.relatedPerfumes").isEmpty())
                .andExpect(jsonPath("$.imageUrls").isEmpty());
    }

    /**
     * 고칠 항목이 없거나 분류·제목·내용을 비우라고 보내면 400 입니다.
     *
     * <p>향수와 이미지 목록은 빈 배열로 연결을 지울 수 있지만 {@code null} 은 받지 않습니다.
     * 지우려는 것인지 실수인지 구분되지 않기 때문입니다.
     */
    @Test
    void rejectsEmptyPatch() throws Exception {
        long postId = write("CHAT", "제목", "본문", null, null);

        for (String body : new String[]{"{}", "{\"title\": \"\"}", "{\"content\": null}",
                "{\"category\": \"\"}", "{\"perfumeIds\": null}", "{\"imageUrls\": null}"}) {
            mockMvc.perform(patch(POST_URL, postId)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(body))
                    .andExpect(status().isBadRequest());
        }
    }

    /** 글을 지우면 이미지와 향수 연결도 함께 사라집니다. 외래키가 지웁니다. */
    @Test
    void deletesPostWithItsLinks() throws Exception {
        long postId = write("CHAT", "지울 글", "본문", List.of(1L), List.of("a.jpg"));

        mockMvc.perform(delete(POST_URL, postId))
                .andExpect(status().isNoContent());

        mockMvc.perform(get(POST_URL, postId))
                .andExpect(status().isNotFound());
        assertThat(countRows("post_images")).isZero();
        assertThat(countRows("post_perfumes")).isZero();
    }

    /**
     * {@code mine} 은 보는 사람마다 다릅니다.
     *
     * <p>화면이 수정·삭제 버튼을 띄울지 정하는 값입니다. 비로그인도 상세를 볼 수 있어야 하므로
     * 로그인하지 않았다고 401 을 내지 않고 거짓으로 답합니다.
     */
    @Test
    void tellsWhetherThePostIsMine() throws Exception {
        long postId = write("CHAT", "내 글", "본문", null, null);

        mockMvc.perform(get(POST_URL, postId))
                .andExpect(jsonPath("$.mine").value(true));

        currentUser.login(OTHER_WRITER_ID);
        mockMvc.perform(get(POST_URL, postId))
                .andExpect(jsonPath("$.mine").value(false));

        currentUser.logout();
        mockMvc.perform(get(POST_URL, postId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.mine").value(false));
    }

    /**
     * 남의 글은 고치거나 지울 수 없습니다. 403 입니다.
     *
     * <p>404 로 답하지 않는 이유는 게시글이 누구나 볼 수 있는 글이기 때문입니다. 존재를 숨길 이유가
     * 없고, 404 면 화면이 "지워졌나" 와 "내 글이 아닌가" 를 구분하지 못합니다.
     */
    @Test
    void rejectsEditingSomeoneElsesPost() throws Exception {
        long postId = write("CHAT", "남의 글", "본문", null, null);
        currentUser.login(OTHER_WRITER_ID);

        mockMvc.perform(patch(POST_URL, postId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\": \"가로채기\"}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code")
                        .value(CommunityErrorCode.COMMUNITY_POST_NOT_OWNED.code()));

        mockMvc.perform(delete(POST_URL, postId))
                .andExpect(status().isForbidden());

        mockMvc.perform(get(POST_URL, postId)).andExpect(status().isOk());
    }

    /** 없는 글은 404 입니다. 읽기도 고치기도 같습니다. */
    @Test
    void returnsNotFoundForMissingPost() throws Exception {
        mockMvc.perform(get(POST_URL, 999))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code")
                        .value(CommunityErrorCode.COMMUNITY_POST_NOT_FOUND.code()));

        mockMvc.perform(delete(POST_URL, 999))
                .andExpect(status().isNotFound());
    }

    /** 없거나 내려간 분류·향수로는 글을 쓸 수 없습니다. 404 입니다. */
    @Test
    void rejectsUnknownCategoryOrPerfume() throws Exception {
        mockMvc.perform(post(POSTS_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createBody("REVIEW", "제목", "본문", null, null)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code")
                        .value(CommunityErrorCode.COMMUNITY_CATEGORY_NOT_FOUND.code()));

        mockMvc.perform(post(POSTS_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createBody("CHAT", "제목", "본문", List.of(3L), null)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code")
                        .value(CommunityErrorCode.COMMUNITY_PERFUME_NOT_FOUND.code()));

        assertThat(countRows("posts")).isZero();
    }

    /** 같은 향수를 두 번 걸면 400 입니다. 화면이 목록을 잘못 만들고 있다는 뜻입니다. */
    @Test
    void rejectsDuplicatePerfumes() throws Exception {
        mockMvc.perform(post(POSTS_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createBody("CHAT", "제목", "본문", List.of(1L, 1L), null)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code")
                        .value(CommunityErrorCode.COMMUNITY_POST_INVALID.code()));
    }

    /** 제목이 50자를 넘거나 제목·내용·분류가 비면 400 입니다. 제목 길이는 컬럼 제한과 같습니다. */
    @Test
    void rejectsInvalidTitleOrContent() throws Exception {
        String tooLong = "가".repeat(51);

        for (String body : new String[]{
                createBody("CHAT", tooLong, "본문", null, null),
                createBody("CHAT", "  ", "본문", null, null),
                createBody("CHAT", "제목", "", null, null),
                createBody("  ", "제목", "본문", null, null),
        }) {
            mockMvc.perform(post(POSTS_URL)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(body))
                    .andExpect(status().isBadRequest());
        }

        assertThat(countRows("posts")).isZero();
    }

    /**
     * 읽기는 로그인 없이도 되고 쓰기는 401 입니다.
     *
     * <p>게시판은 누구나 볼 수 있어야 하고, 글은 쓴 사람에게 매달리는 값입니다.
     */
    @Test
    void allowsReadingWithoutLoginButNotWriting() throws Exception {
        long postId = write("CHAT", "공개 글", "본문", null, null);
        currentUser.logout();

        mockMvc.perform(get(POSTS_URL)).andExpect(status().isOk());
        mockMvc.perform(get(POST_URL, postId)).andExpect(status().isOk());

        mockMvc.perform(post(POSTS_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createBody("CHAT", "제목", "본문", null, null)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code")
                        .value(CommunityErrorCode.COMMUNITY_LOGIN_REQUIRED.code()));

        mockMvc.perform(patch(POST_URL, postId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\": \"고침\"}"))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(delete(POST_URL, postId))
                .andExpect(status().isUnauthorized());
    }

    /**
     * 작성자가 탈퇴해도 글은 남고 닉네임과 프로필 사진만 비어 나갑니다.
     *
     * <p>{@code posts.user_id} 가 {@code ON DELETE SET NULL} 이라 글이 함께 지워지지 않습니다.
     * 대신 주인이 없어져 아무도 고칠 수 없습니다.
     */
    @Test
    void keepsPostAfterTheWriterLeaves() throws Exception {
        long postId = write("CHAT", "남는 글", "본문", null, null);
        jdbcTemplate.update("UPDATE users SET profile_image_url = ? WHERE user_id = ?",
                PROFILE_IMAGE_URL, WRITER_ID);

        jdbcTemplate.update("DELETE FROM users WHERE user_id = ?", WRITER_ID);

        mockMvc.perform(get(POST_URL, postId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("남는 글"))
                .andExpect(jsonPath("$.nickname").doesNotExist())
                .andExpect(jsonPath("$.profileImageUrl").doesNotExist())
                .andExpect(jsonPath("$.mine").value(false));

        currentUser.login(OTHER_WRITER_ID);
        mockMvc.perform(delete(POST_URL, postId))
                .andExpect(status().isForbidden());
    }

    /**
     * API 문서에 다섯 개가 모두 실립니다.
     *
     * <p>문서 애노테이션은 코드와 달라져도 컴파일러가 잡아주지 않습니다. 엔드포인트를 지우거나
     * 옮겼는데 문서만 남는 일을 이 테스트가 막습니다.
     */
    @Test
    void documentsAllPostEndpoints() throws Exception {
        mockMvc.perform(get("/v3/api-docs"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.paths['/api/v1/posts'].get").exists())
                .andExpect(jsonPath("$.paths['/api/v1/posts'].post").exists())
                .andExpect(jsonPath("$.paths['/api/v1/posts/{postId}'].get").exists())
                .andExpect(jsonPath("$.paths['/api/v1/posts/{postId}'].patch").exists())
                .andExpect(jsonPath("$.paths['/api/v1/posts/{postId}'].delete").exists());
    }

    // ────────────────────────────────────────────────────────────────
    // 컬렉션 박제
    // ────────────────────────────────────────────────────────────────

    /**
     * 컬렉션을 붙이면 그 컬렉션의 향수가 글의 향수가 됩니다.
     *
     * <p>컬렉션에 담긴 순서 그대로입니다. 순서가 흔들리면 목록의 대표 향수가 매번 달라집니다.
     */
    @Test
    void copiesCollectionPerfumesWhenAttaching() throws Exception {
        putInCollection(MY_COLLECTION_ID, WRITER_ID, 100, 2, 1);
        putInCollection(MY_COLLECTION_ID, WRITER_ID, 101, 1, 2);

        long postId = writeWithCollection("COLLECTION", "컬렉션 공유 글", MY_COLLECTION_ID);

        mockMvc.perform(get(POST_URL, postId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.collectionId").value(MY_COLLECTION_ID))
                .andExpect(jsonPath("$.collectionTitle").value("내 컬렉션"))
                .andExpect(jsonPath("$.relatedPerfumes[*].perfumeId")
                        .value(Matchers.contains(2, 1)));
    }

    /**
     * 컬렉션을 <b>고쳐도</b> 글은 그대로입니다.
     *
     * <p>글은 그때 그 컬렉션을 소개한 기록이지 지금의 컬렉션을 비추는 창이 아닙니다. 이름을
     * 그때그때 읽으면 이름을 바꾸는 순간 몇 달 전 글의 이름까지 바뀝니다.
     */
    @Test
    void keepsTheSnapshotWhenTheCollectionChanges() throws Exception {
        putInCollection(MY_COLLECTION_ID, WRITER_ID, 100, 1, 1);
        putInCollection(MY_COLLECTION_ID, WRITER_ID, 101, 2, 2);
        long postId = writeWithCollection("COLLECTION", "컬렉션 공유 글", MY_COLLECTION_ID);

        jdbcTemplate.update("UPDATE collections SET name = '이름 바꿈' WHERE collection_id = ?",
                MY_COLLECTION_ID);
        jdbcTemplate.update("DELETE FROM collection_perfumes WHERE user_perfume_id = 101");

        mockMvc.perform(get(POST_URL, postId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.collectionTitle").value("내 컬렉션"))
                .andExpect(jsonPath("$.relatedPerfumes[*].perfumeId")
                        .value(Matchers.contains(1, 2)));
    }

    /**
     * 컬렉션을 <b>지워도</b> 이름과 향수가 남습니다. 번호만 비워집니다.
     *
     * <p>번호는 원본으로 가는 값이라 원본이 없으면 의미가 없지만, 이름과 향수는 글의 내용이라
     * 남아야 합니다. 컬렉션을 정리했다고 그것을 소개한 글이 껍데기가 되면 안 됩니다.
     */
    @Test
    void keepsTheSnapshotWhenTheCollectionIsDeleted() throws Exception {
        putInCollection(MY_COLLECTION_ID, WRITER_ID, 100, 1, 1);
        long postId = writeWithCollection("COLLECTION", "컬렉션 공유 글", MY_COLLECTION_ID);

        jdbcTemplate.update("DELETE FROM collection_perfumes WHERE collection_id = ?",
                MY_COLLECTION_ID);
        jdbcTemplate.update("DELETE FROM collections WHERE collection_id = ?", MY_COLLECTION_ID);

        mockMvc.perform(get(POST_URL, postId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.collectionId").doesNotExist())
                .andExpect(jsonPath("$.collectionTitle").value("내 컬렉션"))
                .andExpect(jsonPath("$.relatedPerfumes[*].perfumeId")
                        .value(Matchers.contains(1)));
    }

    /**
     * 작성자가 탈퇴해도 컬렉션 공유 글이 온전합니다.
     *
     * <p>탈퇴하면 컬렉션과 진열대가 함께 사라지지만, 글에 복사해 둔 향수는 마스터를 가리켜
     * 살아남습니다. 복사하지 않았다면 이름도 향수도 없는 글만 남았을 것입니다.
     */
    @Test
    void keepsTheSnapshotAfterTheWriterLeaves() throws Exception {
        putInCollection(MY_COLLECTION_ID, WRITER_ID, 100, 1, 1);
        long postId = writeWithCollection("COLLECTION", "컬렉션 공유 글", MY_COLLECTION_ID);

        currentUser.logout();
        jdbcTemplate.update("DELETE FROM users WHERE user_id = ?", WRITER_ID);

        mockMvc.perform(get(POST_URL, postId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.nickname").doesNotExist())
                .andExpect(jsonPath("$.profileImageUrl").doesNotExist())
                .andExpect(jsonPath("$.collectionId").doesNotExist())
                .andExpect(jsonPath("$.collectionTitle").value("내 컬렉션"))
                .andExpect(jsonPath("$.relatedPerfumes[*].perfumeId")
                        .value(Matchers.contains(1)));
    }

    /** 컬렉션과 향수를 함께 보내면 400 입니다. 글 하나에 향수 출처가 둘일 수 없습니다. */
    @Test
    void rejectsPerfumesSentWithACollection() throws Exception {
        putInCollection(MY_COLLECTION_ID, WRITER_ID, 100, 1, 1);

        mockMvc.perform(post(POSTS_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"category\": \"COLLECTION\", \"title\": \"글\","
                                + " \"content\": \"본문\", \"collectionId\": " + MY_COLLECTION_ID
                                + ", \"perfumeIds\": [2]}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code")
                        .value(CommunityErrorCode.COMMUNITY_PERFUMES_FROM_COLLECTION.code()));

        assertThat(countRows("posts")).isZero();
    }

    /**
     * 제목만 고치면 향수는 그대로입니다.
     *
     * <p>수정할 때마다 컬렉션을 다시 읽으면 "제목만 고쳤는데 향수가 바뀌어 있다" 가 됩니다.
     * 번호를 다시 보낼 때만 읽습니다.
     */
    @Test
    void keepsTheSnapshotWhenUpdatingOnlyTheTitle() throws Exception {
        putInCollection(MY_COLLECTION_ID, WRITER_ID, 100, 1, 1);
        long postId = writeWithCollection("COLLECTION", "컬렉션 공유 글", MY_COLLECTION_ID);

        jdbcTemplate.update("UPDATE collections SET name = '이름 바꿈' WHERE collection_id = ?",
                MY_COLLECTION_ID);
        putInCollection(MY_COLLECTION_ID, WRITER_ID, 101, 2, 2);

        mockMvc.perform(patch(POST_URL, postId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\": \"제목만 고침\"}"))
                .andExpect(status().isOk());

        mockMvc.perform(get(POST_URL, postId))
                .andExpect(jsonPath("$.title").value("제목만 고침"))
                .andExpect(jsonPath("$.collectionTitle").value("내 컬렉션"))
                .andExpect(jsonPath("$.relatedPerfumes[*].perfumeId")
                        .value(Matchers.contains(1)));
    }

    /** 같은 번호를 다시 보내면 지금의 컬렉션으로 맞춥니다. 그게 다시 읽으라는 뜻입니다. */
    @Test
    void refreshesTheSnapshotWhenTheCollectionIdIsResent() throws Exception {
        putInCollection(MY_COLLECTION_ID, WRITER_ID, 100, 1, 1);
        long postId = writeWithCollection("COLLECTION", "컬렉션 공유 글", MY_COLLECTION_ID);

        jdbcTemplate.update("UPDATE collections SET name = '이름 바꿈' WHERE collection_id = ?",
                MY_COLLECTION_ID);
        putInCollection(MY_COLLECTION_ID, WRITER_ID, 101, 2, 2);

        mockMvc.perform(patch(POST_URL, postId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"collectionId\": " + MY_COLLECTION_ID + "}"))
                .andExpect(status().isOk());

        mockMvc.perform(get(POST_URL, postId))
                .andExpect(jsonPath("$.collectionTitle").value("이름 바꿈"))
                .andExpect(jsonPath("$.relatedPerfumes[*].perfumeId")
                        .value(Matchers.contains(1, 2)));
    }

    /**
     * 컬렉션이 붙은 글에는 향수를 따로 보낼 수 없고, 컬렉션을 떼면서 함께 보내면 됩니다.
     *
     * <p>박제한 목록을 조용히 덮어쓰지 않도록 막습니다. 목록을 직접 정하겠다는 뜻이면 컬렉션을
     * 떼는 것이 먼저입니다.
     */
    @Test
    void rejectsPerfumesUntilTheCollectionIsDetached() throws Exception {
        putInCollection(MY_COLLECTION_ID, WRITER_ID, 100, 1, 1);
        long postId = writeWithCollection("COLLECTION", "컬렉션 공유 글", MY_COLLECTION_ID);

        mockMvc.perform(patch(POST_URL, postId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"perfumeIds\": [2]}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code")
                        .value(CommunityErrorCode.COMMUNITY_PERFUMES_FROM_COLLECTION.code()));

        mockMvc.perform(patch(POST_URL, postId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"collectionId\": null, \"perfumeIds\": [2]}"))
                .andExpect(status().isOk());

        mockMvc.perform(get(POST_URL, postId))
                .andExpect(jsonPath("$.collectionId").doesNotExist())
                .andExpect(jsonPath("$.collectionTitle").doesNotExist())
                .andExpect(jsonPath("$.relatedPerfumes[*].perfumeId")
                        .value(Matchers.contains(2)));
    }

    // ────────────────────────────────────────────────────────────────
    // 좋아요와 조회수
    // ────────────────────────────────────────────────────────────────

    /**
     * 좋아요를 <b>여러 번 눌러도 결과가 같습니다.</b>
     *
     * <p>{@code PUT} 으로 둔 이유입니다. 토글이면 두 번 누를 때 취소되는데, 네트워크가 끊겨 화면이
     * 요청을 다시 보내는 것과 사용자가 두 번 누른 것을 서버가 구분할 수 없습니다.
     */
    @Test
    void likesIdempotently() throws Exception {
        long postId = write("CHAT", "좋아요 받을 글", "본문", null, null);

        for (int attempt = 0; attempt < 3; attempt++) {
            mockMvc.perform(put(LIKE_URL, postId))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.postId").value(postId))
                    .andExpect(jsonPath("$.liked").value(true))
                    .andExpect(jsonPath("$.likeCount").value(1));
        }

        assertThat(countRows("post_likes")).isEqualTo(1);
    }

    /** 취소도 여러 번 해도 됩니다. 누르지 않은 글에 취소해도 오류가 아닙니다. */
    @Test
    void unlikesIdempotently() throws Exception {
        long postId = write("CHAT", "좋아요 받을 글", "본문", null, null);
        mockMvc.perform(put(LIKE_URL, postId)).andExpect(status().isOk());

        for (int attempt = 0; attempt < 3; attempt++) {
            mockMvc.perform(delete(LIKE_URL, postId))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.liked").value(false))
                    .andExpect(jsonPath("$.likeCount").value(0));
        }

        assertThat(countRows("post_likes")).isZero();
    }

    /**
     * {@code liked} 는 보는 사람마다 다르고 {@code likeCount} 는 누구에게나 같습니다.
     *
     * <p>목록과 상세 양쪽을 봅니다. 목록은 번호를 모아 한 번에 읽고 상세는 하나만 확인하는, 서로
     * 다른 길이라 한쪽만 맞는 일이 생길 수 있습니다.
     */
    @Test
    void tellsWhetherILikedThePost() throws Exception {
        long postId = write("CHAT", "좋아요 받을 글", "본문", null, null);
        mockMvc.perform(put(LIKE_URL, postId)).andExpect(status().isOk());

        currentUser.login(OTHER_WRITER_ID);
        mockMvc.perform(put(LIKE_URL, postId)).andExpect(status().isOk());

        mockMvc.perform(get(POST_URL, postId))
                .andExpect(jsonPath("$.likeCount").value(2))
                .andExpect(jsonPath("$.liked").value(true));
        mockMvc.perform(get(POSTS_URL))
                .andExpect(jsonPath("$.posts[0].likeCount").value(2))
                .andExpect(jsonPath("$.posts[0].liked").value(true));

        currentUser.logout();
        mockMvc.perform(get(POST_URL, postId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.likeCount").value(2))
                .andExpect(jsonPath("$.liked").value(false));
        mockMvc.perform(get(POSTS_URL))
                .andExpect(jsonPath("$.posts[0].likeCount").value(2))
                .andExpect(jsonPath("$.posts[0].liked").value(false));
    }

    /** 좋아요는 로그인이 필요하고, 없는 글에는 누를 수 없습니다. */
    @Test
    void rejectsLikeWithoutLoginOrPost() throws Exception {
        long postId = write("CHAT", "글", "본문", null, null);

        mockMvc.perform(put(LIKE_URL, 999L))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code")
                        .value(CommunityErrorCode.COMMUNITY_POST_NOT_FOUND.code()));

        currentUser.logout();
        mockMvc.perform(put(LIKE_URL, postId))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(delete(LIKE_URL, postId))
                .andExpect(status().isUnauthorized());

        assertThat(countRows("post_likes")).isZero();
    }

    /**
     * 글을 지우면 좋아요도 사라지고, 탈퇴해도 그 사람의 좋아요가 사라집니다.
     *
     * <p>글·댓글과 다른 규칙입니다. 글은 남겨야 대화가 이어지지만 좋아요는 그 사람이 눌렀다는
     * 사실 자체라 사람이 없어지면 남을 이유가 없고, 좋아요 수도 그만큼 줄어야 맞습니다.
     */
    @Test
    void removesLikesWhenThePostOrTheUserGoesAway() throws Exception {
        long mine = write("CHAT", "내 글", "본문", null, null);
        mockMvc.perform(put(LIKE_URL, mine)).andExpect(status().isOk());

        currentUser.login(OTHER_WRITER_ID);
        long theirs = write("CHAT", "남의 글", "본문", null, null);
        mockMvc.perform(put(LIKE_URL, theirs)).andExpect(status().isOk());
        assertThat(countRows("post_likes")).isEqualTo(2);

        jdbcTemplate.update("DELETE FROM posts WHERE post_id = ?", mine);
        assertThat(countRows("post_likes")).isEqualTo(1);

        jdbcTemplate.update("DELETE FROM users WHERE user_id = ?", OTHER_WRITER_ID);
        assertThat(countRows("post_likes")).isZero();
    }

    /** 상세를 열 때마다 조회수가 오릅니다. 응답의 값은 이번 조회를 포함합니다. */
    @Test
    void countsAViewEachTimeTheDetailOpens() throws Exception {
        long postId = write("CHAT", "조회될 글", "본문", null, null);

        mockMvc.perform(get(POSTS_URL))
                .andExpect(jsonPath("$.posts[0].viewCount").value(0));

        for (int expected = 1; expected <= 3; expected++) {
            mockMvc.perform(get(POST_URL, postId))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.viewCount").value(expected));
        }

        mockMvc.perform(get(POSTS_URL))
                .andExpect(jsonPath("$.posts[0].viewCount").value(3));
    }

    /**
     * 상세 응답의 조회수가 <b>표에 적힌 값과 같습니다.</b>
     *
     * <p>조회수를 올린 뒤 같은 트랜잭션에서 글을 읽습니다. 올리기 전에 읽어 둔 글이 없고
     * {@code @Modifying(clearAutomatically = true)} 가 영속성 컨텍스트를 비우므로, 뒤따르는
     * 조회는 표를 다시 봅니다. 그래서 방금 올린 값이 그대로 응답에 실립니다.
     *
     * <p>격리 수준과도 무관합니다. 어떤 수준이든 트랜잭션은 자기가 쓴 것을 봅니다.
     *
     * <p>{@code countsAViewEachTimeTheDetailOpens} 가 응답만 보는 데 비해 여기서는 두 값을 맞춰
     * 봅니다. 캐시된 값을 읽는다면 응답만 뒤처져 둘이 어긋납니다.
     */
    @Test
    void returnsTheViewCountThatWasJustStored() throws Exception {
        long postId = write("CHAT", "조회될 글", "본문", null, null);

        String body = mockMvc.perform(get(POST_URL, postId))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();

        long inResponse = objectMapper.readTree(body).get("viewCount").asLong();
        long inTable = jdbcTemplate.queryForObject(
                "SELECT view_count FROM posts WHERE post_id = ?", Long.class, postId);

        assertThat(inResponse).isEqualTo(inTable).isEqualTo(1);
    }

    /** 없는 글을 열어도 조회수가 생기지 않습니다. */
    @Test
    void doesNotCountAViewForAMissingPost() throws Exception {
        mockMvc.perform(get(POST_URL, 999L))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code")
                        .value(CommunityErrorCode.COMMUNITY_POST_NOT_FOUND.code()));
    }

    /** 좋아요 순은 많이 받은 글이 먼저입니다. 같으면 최신순으로 갈립니다. */
    @Test
    void sortsByLikeCount() throws Exception {
        long few = write("CHAT", "하나 받은 글", "본문", null, null);
        long many = write("CHAT", "둘 받은 글", "본문", null, null);

        mockMvc.perform(put(LIKE_URL, few)).andExpect(status().isOk());
        mockMvc.perform(put(LIKE_URL, many)).andExpect(status().isOk());
        currentUser.login(OTHER_WRITER_ID);
        mockMvc.perform(put(LIKE_URL, many)).andExpect(status().isOk());

        mockMvc.perform(get(POSTS_URL).param("sort", "LIKES"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.posts[*].title")
                        .value(Matchers.contains("둘 받은 글", "하나 받은 글")));
    }

    /** 조회 순은 많이 열린 글이 먼저입니다. */
    @Test
    void sortsByViewCount() throws Exception {
        long rarely = write("CHAT", "덜 열린 글", "본문", null, null);
        long often = write("CHAT", "많이 열린 글", "본문", null, null);

        mockMvc.perform(get(POST_URL, rarely)).andExpect(status().isOk());
        mockMvc.perform(get(POST_URL, often)).andExpect(status().isOk());
        mockMvc.perform(get(POST_URL, often)).andExpect(status().isOk());

        mockMvc.perform(get(POSTS_URL).param("sort", "VIEWS"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.posts[*].title")
                        .value(Matchers.contains("많이 열린 글", "덜 열린 글")));
    }

    private long write(
            String category,
            String title,
            String content,
            List<Long> perfumeIds,
            List<String> imageUrls
    ) throws Exception {
        ResultActions created = mockMvc.perform(post(POSTS_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createBody(category, title, content, perfumeIds, imageUrls)))
                .andExpect(status().isCreated());

        JsonNode body = objectMapper.readTree(
                created.andReturn().getResponse().getContentAsString());
        return body.get("postId").asLong();
    }

    private String createBody(
            String category,
            String title,
            String content,
            List<Long> perfumeIds,
            List<String> imageUrls
    ) throws Exception {
        StringBuilder json = new StringBuilder("{\"category\": ")
                .append(objectMapper.writeValueAsString(category))
                .append(", \"title\": ").append(objectMapper.writeValueAsString(title))
                .append(", \"content\": ").append(objectMapper.writeValueAsString(content));
        if (perfumeIds != null) {
            json.append(", \"perfumeIds\": ").append(objectMapper.writeValueAsString(perfumeIds));
        }
        if (imageUrls != null) {
            json.append(", \"imageUrls\": ").append(objectMapper.writeValueAsString(imageUrls));
        }
        return json.append("}").toString();
    }

    /** 댓글을 SQL 로 답니다. 댓글 API 가 바뀌어도 게시글 테스트가 흔들리지 않아야 합니다. */
    private long writeComment(long postId, String content) {
        jdbcTemplate.update("""
                INSERT INTO comments (post_id, user_id, content, created_at, updated_at)
                VALUES (?, ?, ?, NOW(), NOW())
                """, postId, WRITER_ID, content);

        return jdbcTemplate.queryForObject(
                "SELECT MAX(comment_id) FROM comments", Long.class);
    }

    private long writeWithCollection(String category, String title, long collectionId)
            throws Exception {
        String body = mockMvc.perform(post(POSTS_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(collectionBody(category, title, collectionId)))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();

        return objectMapper.readTree(body).get("postId").asLong();
    }

    private String collectionBody(String category, String title, long collectionId)
            throws Exception {
        return "{\"category\": " + objectMapper.writeValueAsString(category)
                + ", \"title\": " + objectMapper.writeValueAsString(title)
                + ", \"content\": \"본문\""
                + ", \"collectionId\": " + collectionId + "}";
    }

    private void insertCollection(long id, long userId, String name) {
        jdbcTemplate.update(
                "INSERT INTO collections (collection_id, user_id, name) VALUES (?, ?, ?)",
                id, userId, name);
    }

    /**
     * 컬렉션에 향수를 담습니다.
     *
     * <p>컬렉션은 향수가 아니라 <b>진열대 항목</b>({@code user_perfumes})을 담으므로 한 칸을 거쳐
     * 갑니다. 진열대 항목 번호는 향수 번호와 겹치지 않게 별도로 받습니다.
     */
    private void putInCollection(
            long collectionId, long ownerId, long shelfItemId, long perfumeId, int order) {
        jdbcTemplate.update("""
                INSERT INTO user_perfumes (user_perfumes_id, user_id, perfume_id, ownership_status)
                VALUES (?, ?, ?, 'OWNED')
                """, shelfItemId, ownerId, perfumeId);
        jdbcTemplate.update("""
                INSERT INTO collection_perfumes (collection_id, user_perfume_id, display_order)
                VALUES (?, ?, ?)
                """, collectionId, shelfItemId, order);
    }

    private int countRows(String table) {
        return jdbcTemplate.queryForObject("SELECT COUNT(*) FROM " + table, Integer.class);
    }

    private void insertUser(long id, String email, String nickname) {
        jdbcTemplate.update(
                "INSERT INTO users (user_id, email, password_hash, nickname) VALUES (?, ?, 'x', ?)",
                id, email, nickname);
    }

    private void insertBrand(long id, String name) {
        jdbcTemplate.update(
                "INSERT INTO brands (brand_id, name, is_active) VALUES (?, ?, true)", id, name);
    }

    private void insertPerfume(long id, String name, boolean active) {
        jdbcTemplate.update(
                "INSERT INTO perfumes (perfume_id, brand_id, name, is_active) VALUES (?, 1, ?, ?)",
                id, name, active);
    }

    /**
     * 테스트가 넣은 것만 지웁니다.
     *
     * <p>{@code post_categories} 는 마이그레이션이 심은 분류 셋이라 건드리지 않습니다.
     */
    private void clearData() {
        jdbcTemplate.update("DELETE FROM post_likes");
        jdbcTemplate.update("DELETE FROM comments");
        jdbcTemplate.update("DELETE FROM post_images");
        jdbcTemplate.update("DELETE FROM post_perfumes");
        jdbcTemplate.update("DELETE FROM posts");
        jdbcTemplate.update("DELETE FROM collection_perfumes");
        jdbcTemplate.update("DELETE FROM collections");
        jdbcTemplate.update("DELETE FROM user_perfumes");
        jdbcTemplate.update("DELETE FROM perfumes");
        jdbcTemplate.update("DELETE FROM brands");
        jdbcTemplate.update("DELETE FROM users");
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
