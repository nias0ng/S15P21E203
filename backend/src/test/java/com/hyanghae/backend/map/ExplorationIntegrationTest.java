package com.hyanghae.backend.map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.hyanghae.backend.global.security.CurrentUser;
import com.hyanghae.backend.map.dto.request.ExplorationMoveRequest;
import com.hyanghae.backend.map.exception.MapErrorCode;
import com.hyanghae.backend.map.service.ExplorationService;
import com.hyanghae.backend.support.IntegrationTest;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

/**
 * 배가 움직인 기록을 실제 PostgreSQL 위에서 검증합니다.
 *
 * <p>인증이 아직 없어 {@link CurrentUser} 를 대역으로 바꿔 로그인한 경우를 만듭니다. 진열대
 * 도메인이 같은 방식을 씁니다.
 *
 * <p>고정 데이터는 지도를 네 구역으로 나눠 놓았습니다. 마이그레이션이 심은 계열 9개는 폴리곤이
 * 비어 있어 판정에 끼어들지 않고, 여기서 넣는 두 개만 모양을 갖습니다.
 *
 * <ul>
 *   <li>영역 A: 왼쪽 아래 사각형(0~0.4). 향수 1 이 이 안에 있습니다.
 *   <li>영역 B: 오른쪽 위 사각형(0.6~1).
 *   <li>그 사이(예: 0.5, 0.5)는 어느 영역에도 없는 바다입니다.
 *   <li>향수 2 는 좌표가 있지만 비활성, 향수 3 은 활성이지만 좌표가 없습니다.
 * </ul>
 */
@IntegrationTest
@AutoConfigureMockMvc
@Import(ExplorationIntegrationTest.FakeCurrentUserConfig.class)
class ExplorationIntegrationTest {

    private static final String MOVE_URL = "/api/v1/map/exploration/me";
    private static final String LOGS_URL = "/api/v1/map/exploration-logs";
    private static final long USER_ID = 1;

    /** ExplorationService 가 일지를 만들 때 훑는 기록 수의 상한과 같은 값입니다. */
    private static final int SCAN_LIMIT = 200;

    private static final long REGION_A_ID = 9001;
    private static final long REGION_B_ID = 9002;
    private static final String REGION_A_POLYGON = "[[[0,0],[0.4,0],[0.4,0.4],[0,0.4]]]";
    private static final String REGION_B_POLYGON = "[[[0.6,0.6],[1,0.6],[1,1],[0.6,1]]]";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private FakeCurrentUser currentUser;

    @Autowired
    private ExplorationService explorationService;

    @BeforeEach
    void insertFixtures() {
        clearData();

        insertRegion(REGION_A_ID, "TEST_A", REGION_A_POLYGON);
        insertRegion(REGION_B_ID, "TEST_B", REGION_B_POLYGON);

        insertUser(USER_ID, "sailor@hyanghae.test", "항해자");
        insertBrand(1, "Chanel");
        insertPerfume(1, "Base Scent", true);
        insertPerfume(2, "Retired Scent", false);
        insertPerfume(3, "Off Map Scent", true);

        insertMapPoint(1, 0.2, 0.3);
        insertMapPoint(2, 0.25, 0.3);

        currentUser.login(USER_ID);
    }

    @AfterEach
    void cleanUp() {
        currentUser.logout();
        clearData();
    }

    /**
     * 향수를 고른 이동은 그 향수의 지도 좌표와 함께 남습니다.
     *
     * <p>요청은 향수 번호만 보냅니다. 화면이 좌표를 보내면 지도에 찍힌 자리와 기록에 남는 자리가
     * 어긋날 수 있습니다.
     */
    @Test
    void recordsPerfumeVisitWithMapCoordinates() throws Exception {
        clickPerfume(1)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.x").value(0.2))
                .andExpect(jsonPath("$.y").value(0.3))
                .andExpect(jsonPath("$.updatedAt").isNotEmpty());

        assertThat(longColumnOf("user_id")).isEqualTo(USER_ID);
        assertThat(longColumnOf("perfume_id")).isEqualTo(1L);
        assertThat(doubleColumnOf("x_coordinate")).isEqualTo(0.2);
        assertThat(doubleColumnOf("y_coordinate")).isEqualTo(0.3);
    }

    /**
     * 같은 향수를 다시 골라도 줄을 따로 쌓습니다.
     *
     * <p>일지는 배가 지나온 자리를 적는 화면이라, 지난번에 본 향수를 다시 봤다면 두 번 나오는
     * 것이 맞습니다. 한 번의 구역 진입 안에서 겹치는 것을 정리하는 일은 일지를 조회할 때 합니다.
     */
    @Test
    void stacksRowsForRepeatedPerfumeVisits() throws Exception {
        clickPerfume(1).andExpect(status().isOk());
        clickPerfume(1).andExpect(status().isOk());

        assertThat(countLogs()).isEqualTo(2);
    }

    /**
     * 지도에 없는 향수는 404 이고 아무것도 남지 않습니다.
     *
     * <p>좌표가 없는 향수(3), 비활성 향수(2), 아예 없는 향수를 같은 코드로 답합니다. 지도에 찍히지
     * 않는 향수로는 배를 옮길 수 없습니다.
     */
    @Test
    void returnsNotFoundForPerfumesOffTheMap() throws Exception {
        for (long perfumeId : new long[]{3, 2, 999}) {
            clickPerfume(perfumeId)
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.code")
                            .value(MapErrorCode.MAP_PERFUME_NOT_FOUND.code()));
        }

        assertThat(countLogs()).isZero();
    }

    /**
     * 빈 바다를 골랐을 때는 향 영역이 바뀐 이동만 남깁니다.
     *
     * <p>배가 지나온 순서대로 한 번씩 눌러 봅니다. 영역 A 로 들어가고, A 안에서 움직이고, 영역
     * 밖 바다로 나가고, 바다에서 움직이고, 영역 B 로 들어갑니다. 남아야 하는 것은 세 번의 변화
     * 입니다. 같은 영역 안의 이동까지 남기면 일지가 적을 내용 없는 줄로 덮입니다.
     */
    @Test
    void recordsSeaMovesOnlyWhenTheRegionChanges() throws Exception {
        clickSea(0.1, 0.1).andExpect(status().isOk());    // 바깥 -> A
        clickSea(0.3, 0.3).andExpect(status().isOk());  // A -> A
        clickSea(0.5, 0.5).andExpect(status().isOk());    // A -> 바다
        clickSea(0.55, 0.5).andExpect(status().isOk()); // 바다 -> 바다
        clickSea(0.7, 0.7).andExpect(status().isOk());    // 바다 -> B

        assertThat(countLogs()).isEqualTo(3);
        assertThat(countLogsWithoutPerfume()).isEqualTo(3);
    }

    /**
     * 첫 클릭이 영역 밖이면 남기지 않습니다.
     *
     * <p>기록이 없는 상태도 "영역 밖" 으로 봅니다. 바다에서 바다로 움직인 것이라 일지에 적을
     * 변화가 없습니다.
     */
    @Test
    void ignoresFirstMoveIntoOpenSea() throws Exception {
        clickSea(0.5, 0.5).andExpect(status().isOk());

        assertThat(countLogs()).isZero();
    }

    /**
     * 향수를 고른 이동도 배가 있던 영역을 옮깁니다.
     *
     * <p>영역 A 안의 향수를 고른 뒤 A 안의 바다를 누르면 남지 않아야 합니다. 향수로 옮긴 자리를
     * 기준으로 삼지 않으면, 배가 이미 A 에 있는데도 A 진입이 다시 기록됩니다.
     */
    @Test
    void treatsPerfumeVisitAsTheShipPosition() throws Exception {
        clickPerfume(1).andExpect(status().isOk());

        clickSea(0.3, 0.3).andExpect(status().isOk());

        assertThat(countLogs()).isEqualTo(1);
    }

    /**
     * 기록은 사용자별로 따로 쌓이고, 영역이 바뀌었는지도 내 기록만 보고 판단합니다.
     *
     * <p>다른 사람이 방금 같은 구역에 들어갔다는 이유로 내 진입이 묻히면 안 됩니다. 직전 위치를
     * 읽는 질의에서 사용자 조건이 빠져도 사용자 한 명으로만 도는 테스트는 통과하므로, 두 명으로
     * 확인합니다.
     */
    @Test
    void keepsRecordsPerUser() throws Exception {
        long otherUserId = 2;
        insertUser(otherUserId, "other@hyanghae.test", "다른 항해자");

        currentUser.login(otherUserId);
        clickSea(0.1, 0.1).andExpect(status().isOk());   // 다른 사용자가 A 로 진입

        currentUser.login(USER_ID);
        clickSea(0.1, 0.1).andExpect(status().isOk());   // 나도 A 로 진입

        assertThat(countLogsOf(USER_ID)).isEqualTo(1);
        assertThat(countLogsOf(otherUserId)).isEqualTo(1);
    }

    /**
     * 배가 있는 자리는 일지에 남지 않는 이동에서도 갱신됩니다.
     *
     * <p>지도를 다시 열었을 때 배를 돌려놓는 값이라, 같은 영역 안에서 움직인 마지막 자리까지
     * 들고 있어야 합니다. 기록만으로 되돌리면 그 영역에 처음 들어간 자리로 갑니다.
     */
    @Test
    void keepsShipPositionEvenWhenNothingIsLogged() throws Exception {
        clickSea(0.1, 0.1).andExpect(status().isOk());
        clickSea(0.3, 0.35).andExpect(status().isOk());

        mockMvc.perform(get(MOVE_URL))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.x").value(0.3))
                .andExpect(jsonPath("$.y").value(0.35))
                .andExpect(jsonPath("$.updatedAt").isNotEmpty());

        assertThat(countLogs()).isEqualTo(1);
    }

    /** 향수를 고른 이동은 그 향수의 지도 좌표가 배의 자리가 됩니다. */
    @Test
    void movesShipToThePerfumeCoordinates() throws Exception {
        clickPerfume(1).andExpect(status().isOk());

        mockMvc.perform(get(MOVE_URL))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.x").value(0.2))
                .andExpect(jsonPath("$.y").value(0.3));
    }

    /**
     * 한 번도 움직인 적이 없으면 세 필드가 모두 비어서 나갑니다.
     *
     * <p>처음 온 사용자는 오류가 아닙니다. 화면은 이 응답을 받아 배를 시작 자리에 놓습니다.
     */
    @Test
    void servesEmptyPositionBeforeTheFirstMove() throws Exception {
        mockMvc.perform(get(MOVE_URL))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.x").doesNotExist())
                .andExpect(jsonPath("$.y").doesNotExist())
                .andExpect(jsonPath("$.updatedAt").doesNotExist());
    }

    /** 배의 자리도 사용자별입니다. 다른 사람이 움직여도 내 자리는 그대로입니다. */
    @Test
    void keepsShipPositionPerUser() throws Exception {
        long otherUserId = 3;
        insertUser(otherUserId, "sailor3@hyanghae.test", "다른 배");

        clickSea(0.1, 0.1).andExpect(status().isOk());

        currentUser.login(otherUserId);
        clickSea(0.7, 0.7).andExpect(status().isOk());

        currentUser.login(USER_ID);
        mockMvc.perform(get(MOVE_URL))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.x").value(0.1))
                .andExpect(jsonPath("$.y").value(0.1));
    }

    /**
     * 같은 사용자가 동시에 여러 번 움직여도 배의 자리는 한 줄로 남습니다.
     *
     * <p>자리는 {@code ON CONFLICT} 로 넣거나 덮어씁니다. 조회해서 있으면 수정하고 없으면 넣는
     * 방식이면 여러 요청이 같은 순간에 "없다" 를 보고 각자 넣어 기본키 충돌로 실패합니다.
     *
     * <p>기록 쪽은 개수를 단언하지 않습니다. 동시에 들어온 클릭들이 서로의 직전 기록을 보지 못해
     * 같은 구역 진입이 여러 줄 남을 수 있습니다. 제약으로 막을 수 있는 것이 아니고(같은 향수를
     * 다시 고르는 것은 허용해야 합니다), 일지 조회가 연속된 같은 구역을 한 줄로 묶으므로 화면에는
     * 드러나지 않습니다.
     */
    @Test
    void keepsOneShipPositionUnderConcurrentMoves() throws Exception {
        int movers = 8;
        ExecutorService pool = Executors.newFixedThreadPool(movers);
        CountDownLatch ready = new CountDownLatch(movers);
        CountDownLatch start = new CountDownLatch(1);
        List<Future<?>> moves = new ArrayList<>();

        try {
            for (int i = 0; i < movers; i++) {
                double y = 0.10 + i * 0.01;
                moves.add(pool.submit(() -> {
                    ready.countDown();
                    start.await();
                    return explorationService.move(
                            new ExplorationMoveRequest(null, 0.1, y));
                }));
            }
            ready.await();
            start.countDown();
            for (Future<?> move : moves) {
                move.get();
            }
        } finally {
            pool.shutdownNow();
        }

        assertThat(countStatesOf(USER_ID)).isEqualTo(1);
    }

    /**
     * 향해 일지는 구역 진입 단위로 묶여 최근 것부터 나옵니다.
     *
     * <p>배가 지나온 순서대로 눌러 봅니다. A 구역에 들어가 향수를 두 번 고르고(같은 향수를 두 번
     * 포함), 바다로 나갔다가 B 구역으로 들어갑니다. 일지는 진입 두 줄이고, A 줄에는 향수가 한 번만
     * 나오며, 바다로 나간 줄은 보이지 않습니다.
     */
    @Test
    void groupsVoyageLogByRegionEntry() throws Exception {
        clickSea(0.1, 0.1).andExpect(status().isOk());   // A 진입
        clickPerfume(1).andExpect(status().isOk());      // A 안의 향수
        clickPerfume(1).andExpect(status().isOk());      // 같은 향수를 다시
        clickSea(0.5, 0.5).andExpect(status().isOk());   // 영역 밖 바다
        clickSea(0.7, 0.7).andExpect(status().isOk());   // B 진입

        mockMvc.perform(get(LOGS_URL))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.entries.length()").value(2))
                .andExpect(jsonPath("$.entries[0].region").value("TEST_B"))
                .andExpect(jsonPath("$.entries[0].visited").isEmpty())
                .andExpect(jsonPath("$.entries[1].region").value("TEST_A"))
                .andExpect(jsonPath("$.entries[1].scentRegionId").value(REGION_A_ID))
                .andExpect(jsonPath("$.entries[1].enteredAt").isNotEmpty())
                .andExpect(jsonPath("$.entries[1].visited.length()").value(1))
                .andExpect(jsonPath("$.entries[1].visited[0].perfumeId").value(1))
                .andExpect(jsonPath("$.entries[1].visited[0].name").value("Base Scent"));
    }

    /**
     * 바다에 나갔다 같은 구역으로 돌아오면 진입이 두 줄입니다.
     *
     * <p>배가 그 구역을 두 번 지난 것이라 일지에도 두 번 적는 것이 맞습니다.
     */
    @Test
    void splitsEntriesWhenTheShipLeavesAndReturns() throws Exception {
        clickSea(0.1, 0.1).andExpect(status().isOk());   // A 진입
        clickSea(0.5, 0.5).andExpect(status().isOk());   // 영역 밖으로
        clickSea(0.2, 0.2).andExpect(status().isOk());   // A 로 다시

        mockMvc.perform(get(LOGS_URL))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.entries.length()").value(2))
                .andExpect(jsonPath("$.entries[0].region").value("TEST_A"))
                .andExpect(jsonPath("$.entries[1].region").value("TEST_A"));
    }

    /** {@code size} 로 받을 진입 수를 줄일 수 있습니다. 최근 것부터 남습니다. */
    @Test
    void limitsVoyageLogEntries() throws Exception {
        clickSea(0.1, 0.1).andExpect(status().isOk());   // A
        clickSea(0.7, 0.7).andExpect(status().isOk());   // B

        mockMvc.perform(get(LOGS_URL).param("size", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.entries.length()").value(1))
                .andExpect(jsonPath("$.entries[0].region").value("TEST_B"));
    }

    /**
     * 한 덩어리가 훑는 상한을 다 채워도 일지가 비지 않습니다.
     *
     * <p>상한에 걸리면 가장 오래된 덩어리를 버립니다. 그 덩어리를 연 기록이 상한 밖에 남아 시각과
     * 향수 목록이 잘려 보이기 때문입니다. 그런데 한 구역에 머물며 향수를 계속 누른 사용자는 상한이
     * 전부 한 덩어리가 되고, 그것까지 버리면 가장 열심히 본 사람의 일지가 텅 빕니다.
     *
     * <p>기록을 직접 넣습니다. 같은 수만큼 실제로 누르면 요청이 200번 나가 테스트가 느려집니다.
     */
    @Test
    void keepsTheOnlyEntryWhenItFillsTheScanLimit() throws Exception {
        for (int i = 0; i < SCAN_LIMIT; i++) {
            insertLog(USER_ID, 1L, 0.2, 0.3);
        }

        mockMvc.perform(get(LOGS_URL))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.entries.length()").value(1))
                .andExpect(jsonPath("$.entries[0].region").value("TEST_A"))
                .andExpect(jsonPath("$.entries[0].visited.length()").value(1));
    }

    /** 움직인 적이 없으면 일지가 빕니다. 오류가 아닙니다. */
    @Test
    void servesEmptyVoyageLogBeforeTheFirstMove() throws Exception {
        mockMvc.perform(get(LOGS_URL))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.entries").isEmpty());
    }

    /** 일지도 사용자별입니다. 다른 사람의 항해는 내 일지에 나오지 않습니다. */
    @Test
    void keepsVoyageLogPerUser() throws Exception {
        long otherUserId = 4;
        insertUser(otherUserId, "sailor4@hyanghae.test", "남의 배");

        currentUser.login(otherUserId);
        clickSea(0.7, 0.7).andExpect(status().isOk());   // 다른 사용자가 B 로

        currentUser.login(USER_ID);
        clickSea(0.1, 0.1).andExpect(status().isOk());   // 나는 A 로

        mockMvc.perform(get(LOGS_URL))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.entries.length()").value(1))
                .andExpect(jsonPath("$.entries[0].region").value("TEST_A"));
    }

    /** 일지 조회도 로그인이 필요합니다. */
    @Test
    void requiresLoginToReadVoyageLog() throws Exception {
        currentUser.logout();

        mockMvc.perform(get(LOGS_URL))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value(MapErrorCode.MAP_LOGIN_REQUIRED.code()));
    }

    /** 자리 조회도 로그인이 필요합니다. */
    @Test
    void requiresLoginToReadPosition() throws Exception {
        currentUser.logout();

        mockMvc.perform(get(MOVE_URL))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value(MapErrorCode.MAP_LOGIN_REQUIRED.code()));
    }

    /** 로그인하지 않으면 401 이고 아무것도 남지 않습니다. 기록은 사용자에게 매달리는 값입니다. */
    @Test
    void requiresLogin() throws Exception {
        currentUser.logout();

        clickPerfume(1)
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value(MapErrorCode.MAP_LOGIN_REQUIRED.code()));

        assertThat(countLogs()).isZero();
    }

    /** 향수 번호도 좌표도 없으면 400 입니다. 어디로 움직였는지 모르는 기록은 남길 수 없습니다. */
    @Test
    void rejectsRequestWithoutPerfumeOrCoordinate() throws Exception {
        mockMvc.perform(put(MOVE_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code")
                        .value(MapErrorCode.MAP_EXPLORATION_POINT_REQUIRED.code()));

        assertThat(countLogs()).isZero();
    }

    private ResultActions clickPerfume(long perfumeId) throws Exception {
        return mockMvc.perform(put(MOVE_URL)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"perfumeId\": " + perfumeId + "}"));
    }

    private ResultActions clickSea(double x, double y) throws Exception {
        return mockMvc.perform(put(MOVE_URL)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"x\": " + x + ", \"y\": " + y + "}"));
    }

    private Long longColumnOf(String column) {
        return jdbcTemplate.queryForObject(
                "SELECT " + column + " FROM map_exploration_logs", Long.class);
    }

    private Double doubleColumnOf(String column) {
        return jdbcTemplate.queryForObject(
                "SELECT " + column + " FROM map_exploration_logs", Double.class);
    }

    private int countLogs() {
        return jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM map_exploration_logs", Integer.class);
    }

    private int countStatesOf(long userId) {
        return jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM map_exploration_states WHERE user_id = ?",
                Integer.class,
                userId);
    }

    private int countLogsOf(long userId) {
        return jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM map_exploration_logs WHERE user_id = ?",
                Integer.class,
                userId);
    }

    private int countLogsWithoutPerfume() {
        return jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM map_exploration_logs WHERE perfume_id IS NULL",
                Integer.class);
    }

    private void insertRegion(long id, String code, String polygon) {
        jdbcTemplate.update(
                "INSERT INTO scent_regions (scent_region_id, code, name, display_order, polygon,"
                        + " is_active) VALUES (?, ?, ?, 100, ?::jsonb, true)",
                id, code, code, polygon);
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

    private void insertLog(long userId, Long perfumeId, double x, double y) {
        jdbcTemplate.update(
                "INSERT INTO map_exploration_logs (user_id, perfume_id, x_coordinate,"
                        + " y_coordinate) VALUES (?, ?, ?, ?)",
                userId, perfumeId, x, y);
    }

    private void insertMapPoint(long perfumeId, double x, double y) {
        jdbcTemplate.update(
                "INSERT INTO perfume_map_points (perfume_id, map_x, map_y) VALUES (?, ?, ?)",
                perfumeId, x, y);
    }

    /**
     * 테스트가 넣은 것만 지웁니다.
     *
     * <p>{@code scent_regions} 는 마이그레이션이 심은 계열 9개가 들어 있어 전체를 지우면 다른
     * 테스트가 함께 깨집니다. 그래서 테스트가 넣은 두 행만 번호로 지웁니다.
     */
    private void clearData() {
        jdbcTemplate.update("DELETE FROM map_exploration_logs");
        jdbcTemplate.update("DELETE FROM map_exploration_states");
        jdbcTemplate.update("DELETE FROM perfume_map_points");
        jdbcTemplate.update("DELETE FROM perfumes");
        jdbcTemplate.update("DELETE FROM brands");
        jdbcTemplate.update("DELETE FROM users");
        jdbcTemplate.update(
                "DELETE FROM scent_regions WHERE scent_region_id IN (?, ?)",
                REGION_A_ID, REGION_B_ID);
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
