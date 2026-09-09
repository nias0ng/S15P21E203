package com.hyanghae.backend.perfume;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.doAnswer;

import com.hyanghae.backend.perfume.dto.response.PerfumePostsResponse;
import com.hyanghae.backend.perfume.repository.PerfumePostRepository;
import com.hyanghae.backend.perfume.service.PerfumeService;
import com.hyanghae.backend.support.IntegrationTest;
import java.time.OffsetDateTime;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;

/**
 * 관련 게시글 조회가 목록과 전체 개수를 같은 시점에서 보는지 검증합니다.
 *
 * <p>목록과 개수를 두 번의 쿼리로 얻습니다. 기본 격리 수준인 {@code READ COMMITTED} 에서는 문장마다
 * 새 스냅샷을 잡으므로, 두 쿼리 사이에 게시글이 커밋되면 {@code totalElements} 만 늘어나 목록과
 * 어긋납니다.
 *
 * <p>타이밍 경합에 기대지 않습니다. 리포지토리를 감싸 목록 조회가 끝난 직후에 삽입을 끼워 넣고,
 * 삽입이 커밋될 때까지 기다린 뒤 개수 조회가 일어나게 합니다. 순서가 확정되어 있어 매번 같은
 * 결과가 나옵니다.
 *
 * <p>삽입은 반드시 다른 스레드에서 해야 합니다. 같은 스레드에서 {@code JdbcTemplate} 을 쓰면
 * Spring 이 진행 중인 트랜잭션의 커넥션을 물려주어 같은 트랜잭션 안에서 실행되고, 검증하려는
 * 상황이 재현되지 않습니다.
 */
@IntegrationTest
class PerfumePostsConcurrencyIntegrationTest {

    private static final long PERFUME_ID = 1L;
    private static final int EXISTING_POSTS = 3;

    @Autowired
    private PerfumeService perfumeService;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @MockitoSpyBean
    private PerfumePostRepository perfumePostRepository;

    private ExecutorService otherConnection;

    @BeforeEach
    void insertFixtures() {
        clearData();
        otherConnection = Executors.newSingleThreadExecutor();

        insertBrand(1, "Chanel");
        insertPerfume(PERFUME_ID, "Base Scent");

        for (int i = 0; i < EXISTING_POSTS; i++) {
            insertPost(100 + i, "기존 글 " + i);
            linkPost(100 + i, PERFUME_ID);
        }
    }

    @AfterEach
    void cleanUp() {
        otherConnection.shutdownNow();
        clearData();
    }

    /**
     * 목록을 읽은 뒤 개수를 세기 전에 게시글이 하나 늘어나도, 응답 안에서는 두 값이 맞아야 합니다.
     * 페이지 크기가 충분해 목록에 전부 담기므로 목록 길이와 전체 개수가 같아야 합니다.
     */
    @Test
    void keepsTotalElementsConsistentWithListWhenPostIsCommittedMidRequest() {
        insertFromOtherConnectionAfterListQuery();

        PerfumePostsResponse response = perfumeService.getPosts(PERFUME_ID, 0, 20);

        assertThat(response.posts()).hasSize(EXISTING_POSTS);
        assertThat(response.totalElements())
                .as("목록과 전체 개수가 같은 스냅샷을 봐야 합니다")
                .isEqualTo(response.posts().size());
    }

    /** 끼워 넣은 게시글이 실제로 저장됐는지 확인합니다. 삽입이 실패했다면 위 검증은 의미가 없습니다. */
    @Test
    void insertedPostIsVisibleToLaterRequests() {
        insertFromOtherConnectionAfterListQuery();

        perfumeService.getPosts(PERFUME_ID, 0, 20);
        PerfumePostsResponse afterwards = perfumeService.getPosts(PERFUME_ID, 0, 20);

        assertThat(afterwards.totalElements()).isGreaterThan(EXISTING_POSTS);
    }

    /**
     * 목록 조회가 끝난 직후, 개수 조회가 시작되기 전에 다른 커넥션에서 게시글을 커밋합니다.
     * {@code Future.get()} 으로 커밋이 끝날 때까지 기다리므로 순서가 확정됩니다.
     */
    private void insertFromOtherConnectionAfterListQuery() {
        doAnswer(invocation -> {
            Object result = invocation.callRealMethod();
            long id = System.nanoTime();
            otherConnection.submit(() -> {
                insertPost(id, "끼어든 글");
                linkPost(id, PERFUME_ID);
            }).get();
            return result;
        }).when(perfumePostRepository).findPageByPerfumeId(any(), anyInt(), anyLong());
    }

    private void insertBrand(long id, String name) {
        jdbcTemplate.update(
                "INSERT INTO brands (brand_id, name, is_active) VALUES (?, ?, true)", id, name);
    }

    private void insertPerfume(long id, String name) {
        jdbcTemplate.update(
                "INSERT INTO perfumes (perfume_id, brand_id, name, is_active)"
                        + " VALUES (?, 1, ?, true)",
                id, name);
    }

    private void insertPost(long id, String title) {
        jdbcTemplate.update(
                "INSERT INTO posts (post_id, title, created_at) VALUES (?, ?, ?)",
                id, title, OffsetDateTime.now());
    }

    private void linkPost(long postId, long perfumeId) {
        jdbcTemplate.update(
                "INSERT INTO post_perfumes (post_id, perfume_id) VALUES (?, ?)", postId, perfumeId);
    }

    private void clearData() {
        jdbcTemplate.update("DELETE FROM post_perfumes");
        jdbcTemplate.update("DELETE FROM posts");
        jdbcTemplate.update("DELETE FROM perfumes");
        jdbcTemplate.update("DELETE FROM brands");
    }
}
