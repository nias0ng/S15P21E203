package com.hyanghae.backend.perfumeview;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hyanghae.backend.global.security.CurrentUser;
import com.hyanghae.backend.support.IntegrationTest;
import java.util.Optional;
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
import org.springframework.test.web.servlet.MvcResult;

@IntegrationTest
@AutoConfigureMockMvc
@ActiveProfiles({"manual-test", "test"})
class PerfumeViewIntegrationTest {

    private static final String PERFUME_VIEWS_URL = "/api/v1/perfume-views";

    @Autowired
    MockMvc mockMvc;

    @Autowired
    ObjectMapper objectMapper;

    @Autowired
    JdbcTemplate jdbcTemplate;

    @Autowired
    FakeCurrentUser fakeCurrentUser;

    @BeforeEach
    void setUp() {
        clearData();
        jdbcTemplate.update("""
                INSERT INTO users (user_id, email, password_hash, nickname)
                VALUES (1, 'first@example.com', 'password', '첫째'),
                       (2, 'second@example.com', 'password', '둘째')
                """);
        jdbcTemplate.update("""
                INSERT INTO perfumes (perfume_id, name, is_active)
                VALUES (1, 'Target', TRUE),
                       (2, 'Source', TRUE),
                       (3, 'Inactive', FALSE)
                """);
        fakeCurrentUser.login(1L);
    }

    @AfterEach
    void clearData() {
        jdbcTemplate.update("DELETE FROM user_perfume_views");
        jdbcTemplate.update("DELETE FROM perfumes");
        jdbcTemplate.update("DELETE FROM users");
    }

    @Test
    void startsAndExitsPerfumeViewUsingServerTime() throws Exception {
        MvcResult startResult = mockMvc.perform(post(PERFUME_VIEWS_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "perfumeId": 1,
                                  "fromLocationType": "RELATED_PERFUME",
                                  "fromPerfumeId": 2
                                }
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.perfumeViewId").isNumber())
                .andExpect(jsonPath("$.viewedAt").exists())
                .andReturn();
        long perfumeViewId = objectMapper.readTree(
                startResult.getResponse().getContentAsString()
        ).get("perfumeViewId").asLong();

        mockMvc.perform(patch(PERFUME_VIEWS_URL + "/" + perfumeViewId + "/exit"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.perfumeViewId").value(perfumeViewId))
                .andExpect(jsonPath("$.exitedAt").exists())
                .andExpect(jsonPath("$.durationSeconds").isNumber());

        var row = jdbcTemplate.queryForMap("""
                SELECT user_id, perfume_id, from_location_type, from_perfume_id,
                       viewed_at, exited_at, duration_seconds
                FROM user_perfume_views
                WHERE perfume_view_id = ?
                """, perfumeViewId);
        assertThat(row.get("user_id")).isEqualTo(1L);
        assertThat(row.get("perfume_id")).isEqualTo(1L);
        assertThat(row.get("from_location_type")).isEqualTo("RELATED_PERFUME");
        assertThat(row.get("from_perfume_id")).isEqualTo(2L);
        assertThat(row.get("viewed_at")).isNotNull();
        assertThat(row.get("exited_at")).isNotNull();
        assertThat((Integer) row.get("duration_seconds")).isGreaterThanOrEqualTo(0);
    }

    @Test
    void repeatedExitKeepsFirstResult() throws Exception {
        long perfumeViewId = startView(1L);

        JsonNode first = exitView(perfumeViewId);
        JsonNode second = exitView(perfumeViewId);

        assertThat(second.get("exitedAt").asText()).isEqualTo(first.get("exitedAt").asText());
        assertThat(second.get("durationSeconds").asInt())
                .isEqualTo(first.get("durationSeconds").asInt());
    }

    @Test
    void requiresLoginAndProtectsAnotherUsersView() throws Exception {
        long perfumeViewId = startView(1L);

        fakeCurrentUser.login(2L);
        mockMvc.perform(patch(PERFUME_VIEWS_URL + "/" + perfumeViewId + "/exit"))
                .andExpect(status().isNotFound());

        fakeCurrentUser.logout();
        mockMvc.perform(post(PERFUME_VIEWS_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"perfumeId\":1,\"fromLocationType\":\"DIRECT\"}"))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(patch(PERFUME_VIEWS_URL + "/" + perfumeViewId + "/exit"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void rejectsUnavailableTargetAndSourcePerfume() throws Exception {
        mockMvc.perform(post(PERFUME_VIEWS_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"perfumeId\":3,\"fromLocationType\":\"DIRECT\"}"))
                .andExpect(status().isNotFound());
        mockMvc.perform(post(PERFUME_VIEWS_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "perfumeId": 1,
                                  "fromLocationType": "RELATED_PERFUME",
                                  "fromPerfumeId": 99
                                }
                                """))
                .andExpect(status().isNotFound());
    }

    @Test
    void rejectsInvalidStartRequest() throws Exception {
        mockMvc.perform(post(PERFUME_VIEWS_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(post(PERFUME_VIEWS_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"perfumeId":-1,"fromLocationType":"DIRECT"}
                                """))
                .andExpect(status().isBadRequest());
        mockMvc.perform(post(PERFUME_VIEWS_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"perfumeId":1,"fromLocationType":"RELATED_PERFUME"}
                                """))
                .andExpect(status().isBadRequest());
        mockMvc.perform(post(PERFUME_VIEWS_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "perfumeId":1,
                                  "fromLocationType":"SCENT_MAP",
                                  "fromPerfumeId":2
                                }
                                """))
                .andExpect(status().isBadRequest());
        mockMvc.perform(post(PERFUME_VIEWS_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"perfumeId":1,"fromLocationType":"UNKNOWN"}
                                """))
                .andExpect(status().isBadRequest());
    }

    @Test
    void documentsPerfumeViewEndpoints() throws Exception {
        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .get("/v3/api-docs"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.paths['/api/v1/perfume-views'].post").exists())
                .andExpect(jsonPath(
                        "$.paths['/api/v1/perfume-views/{perfumeViewId}/exit'].patch"
                ).exists());
    }

    private long startView(Long perfumeId) throws Exception {
        MvcResult result = mockMvc.perform(post(PERFUME_VIEWS_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"perfumeId":%d,"fromLocationType":"DIRECT"}
                                """.formatted(perfumeId)))
                .andExpect(status().isCreated())
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString())
                .get("perfumeViewId")
                .asLong();
    }

    private JsonNode exitView(long perfumeViewId) throws Exception {
        MvcResult result = mockMvc.perform(
                        patch(PERFUME_VIEWS_URL + "/" + perfumeViewId + "/exit")
                )
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString());
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

        private Long userId;

        void login(Long userId) {
            this.userId = userId;
        }

        void logout() {
            userId = null;
        }

        @Override
        public Optional<Long> id() {
            return Optional.ofNullable(userId);
        }
    }
}
