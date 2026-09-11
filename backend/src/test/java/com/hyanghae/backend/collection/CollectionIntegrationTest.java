package com.hyanghae.backend.collection;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hyanghae.backend.global.security.CurrentUser;
import com.hyanghae.backend.support.IntegrationTest;
import java.util.Optional;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.*;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

@IntegrationTest
@AutoConfigureMockMvc
@org.springframework.test.context.ActiveProfiles({"manual-test", "test"})
class CollectionIntegrationTest {
    private static final String URL = "/api/v1/users/me/collections";
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired ObjectMapper mapper;
    @Autowired FakeUser user;

    @BeforeEach
    void setup() {
        clear();
        jdbc.update("INSERT INTO users (user_id,email,password_hash,nickname) VALUES (1,'a','x','a'),(2,'b','x','b')");
        jdbc.update("INSERT INTO perfumes (perfume_id,name) VALUES (1,'First'),(2,'Second')");
        jdbc.update("INSERT INTO user_perfumes (user_perfumes_id,user_id,perfume_id) VALUES (1,1,1),(2,1,2),(3,2,1)");
        user.id = 1L;
    }

    @AfterEach
    void clear() {
        jdbc.update("DELETE FROM collection_perfumes");
        jdbc.update("DELETE FROM collections");
        jdbc.update("DELETE FROM memos");
        jdbc.update("DELETE FROM user_perfumes");
        jdbc.update("DELETE FROM perfumes");
        jdbc.update("DELETE FROM users");
    }

    long create(String name) throws Exception {
        String body = mapper.writeValueAsString(java.util.Map.of("name",name,"description","desc","shelfItemIds",java.util.List.of(2,1)));
        String result = mvc.perform(post(URL).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        return mapper.readTree(result).get("collectionId").asLong();
    }

    @Test
    void documentsAllSevenEndpoints() throws Exception {
        mvc.perform(get("/v3/api-docs")).andExpect(status().isOk())
                .andExpect(jsonPath("$.paths['/api/v1/users/me/collections'].get").exists())
                .andExpect(jsonPath("$.paths['/api/v1/users/me/collections'].post").exists())
                .andExpect(jsonPath("$.paths['/api/v1/users/me/collections/{collectionId}'].get").exists())
                .andExpect(jsonPath("$.paths['/api/v1/users/me/collections/{collectionId}'].patch").exists())
                .andExpect(jsonPath("$.paths['/api/v1/users/me/collections/{collectionId}'].delete").exists())
                .andExpect(jsonPath("$.paths['/api/v1/users/me/collections/{collectionId}/perfumes'].post").exists())
                .andExpect(jsonPath("$.paths['/api/v1/users/me/collections/{collectionId}/perfumes/{shelfItemId}'].delete").exists());
    }

    @Test
    void addsAndRemovesCollectionPerfume() throws Exception {
        long collectionId = create("addition");
        jdbc.update("INSERT INTO perfumes (perfume_id,name) VALUES (4,'Third')");
        jdbc.update("""
                INSERT INTO user_perfumes (user_perfumes_id,user_id,perfume_id)
                VALUES (4,1,4)
                """);

        mvc.perform(post(URL + "/" + collectionId + "/perfumes")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"shelfItemId\":4}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.collectionId").value(collectionId))
                .andExpect(jsonPath("$.shelfItemId").value(4))
                .andExpect(jsonPath("$.createdAt").exists());

        mvc.perform(get(URL + "/" + collectionId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.perfumes.length()").value(3))
                .andExpect(jsonPath("$.perfumes[2].shelfItemId").value(4));

        mvc.perform(delete(URL + "/" + collectionId + "/perfumes/4"))
                .andExpect(status().isNoContent());

        assertThat(jdbc.queryForObject(
                "SELECT COUNT(*) FROM collection_perfumes WHERE collection_id = ?",
                Long.class,
                collectionId
        )).isEqualTo(2);
        assertThat(jdbc.queryForObject(
                "SELECT COUNT(*) FROM user_perfumes WHERE user_perfumes_id = 4",
                Long.class
        )).isOne();
    }

    @Test
    void rejectsDuplicateAndForeignShelfItem() throws Exception {
        long collectionId = create("validation");

        mvc.perform(post(URL + "/" + collectionId + "/perfumes")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"shelfItemId\":1}"))
                .andExpect(status().isConflict());

        mvc.perform(post(URL + "/" + collectionId + "/perfumes")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"shelfItemId\":3}"))
                .andExpect(status().isNotFound());
    }

    @Test
    void rejectsRemovingLastCollectionPerfume() throws Exception {
        String result = mvc.perform(post(URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"single\",\"shelfItemIds\":[1]}"))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();
        long collectionId = mapper.readTree(result).get("collectionId").asLong();

        mvc.perform(delete(URL + "/" + collectionId + "/perfumes/1"))
                .andExpect(status().isConflict());
        assertThat(jdbc.queryForObject(
                "SELECT COUNT(*) FROM collection_perfumes WHERE collection_id = ?",
                Long.class,
                collectionId
        )).isOne();
    }

    @ParameterizedTest
    @ValueSource(strings = {"{}", "{\"shelfItemId\":null}", "{\"shelfItemId\":0}"})
    void rejectsInvalidCollectionPerfumeCreate(String body) throws Exception {
        long collectionId = create("invalid-addition");

        mvc.perform(post(URL + "/" + collectionId + "/perfumes")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isBadRequest());
    }

    @Test
    void createsAndReadsBothViews() throws Exception {
        long id = create(" Summer ");
        mvc.perform(get(URL)).andExpect(status().isOk())
                .andExpect(jsonPath("$.collections[0].name").value("Summer"))
                .andExpect(jsonPath("$.collections[0].perfumeCount").value(2))
                .andExpect(jsonPath("$.page").value(0)).andExpect(jsonPath("$.size").value(10));
        mvc.perform(get(URL + "/" + id)).andExpect(status().isOk())
                .andExpect(jsonPath("$.perfumes[0].shelfItemId").value(2))
                .andExpect(jsonPath("$.perfumes[1].name").value("First"));
        mvc.perform(get(URL).param("page","99")).andExpect(status().isOk())
                .andExpect(jsonPath("$.collections").isEmpty())
                .andExpect(jsonPath("$.totalElements").value(1));
    }

    @Test
    void rejectsDuplicateNameButAllowsAnotherUser() throws Exception {
        create("Summer");
        mvc.perform(post(URL).contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\" summer \",\"shelfItemIds\":[1]}"))
                .andExpect(status().isConflict());
        user.id = 2L;
        mvc.perform(post(URL).contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"summer\",\"shelfItemIds\":[3]}"))
                .andExpect(status().isCreated());
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "{\"name\":\"a\",\"shelfItemIds\":[]}",
            "{\"name\":\"a\",\"shelfItemIds\":[1,1]}",
            "{\"name\":\" \",\"shelfItemIds\":[1]}",
            "{\"name\":\"a\",\"shelfItemIds\":[null]}"
    })
    void rejectsInvalidCreate(String body) throws Exception {
        mvc.perform(post(URL).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest());
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM collections", Long.class)).isZero();
    }

    @Test
    void rejectsForeignShelfAndRollsBack() throws Exception {
        mvc.perform(post(URL).contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"a\",\"shelfItemIds\":[1,3]}"))
                .andExpect(status().isNotFound());
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM collections", Long.class)).isZero();
    }

    @Test
    void patchPreservesOmittedFieldsAndClearsDescription() throws Exception {
        long id = create("before");
        mvc.perform(patch(URL+"/"+id).contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"after\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.description").value("desc"));
        mvc.perform(patch(URL+"/"+id).contentType(MediaType.APPLICATION_JSON)
                .content("{\"description\":null}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.name").value("after"))
                .andExpect(jsonPath("$.description").doesNotExist());
        mvc.perform(patch(URL+"/"+id).contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest());
        mvc.perform(patch(URL+"/"+id).contentType(MediaType.APPLICATION_JSON).content("{\"name\":null}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void rejectsDuplicateRename() throws Exception {
        create("one");
        long id = create("two");
        mvc.perform(patch(URL+"/"+id).contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"ONE\"}"))
                .andExpect(status().isConflict());
        mvc.perform(get(URL+"/"+id)).andExpect(jsonPath("$.name").value("two"));
    }

    @Test
    void deletesLinksButPreservesShelf() throws Exception {
        long id = create("a");
        mvc.perform(delete(URL+"/"+id)).andExpect(status().isNoContent());
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM collection_perfumes", Long.class)).isZero();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM user_perfumes", Long.class)).isEqualTo(3);
        mvc.perform(get(URL+"/"+id)).andExpect(status().isNotFound());
    }

    @Test
    void protectsEveryOperation() throws Exception {
        long id = create("private");
        user.id = 2L;
        mvc.perform(get(URL)).andExpect(jsonPath("$.collections").isEmpty());
        mvc.perform(get(URL+"/"+id)).andExpect(status().isNotFound());
        mvc.perform(delete(URL+"/"+id)).andExpect(status().isNotFound());
        mvc.perform(patch(URL+"/"+id).contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"x\"}"))
                .andExpect(status().isNotFound());
        mvc.perform(post(URL + "/" + id + "/perfumes")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"shelfItemId\":3}"))
                .andExpect(status().isNotFound());
        mvc.perform(delete(URL + "/" + id + "/perfumes/1"))
                .andExpect(status().isNotFound());
        user.id = null;
        mvc.perform(get(URL)).andExpect(status().isUnauthorized());
        mvc.perform(get(URL+"/"+id)).andExpect(status().isUnauthorized());
        mvc.perform(delete(URL+"/"+id)).andExpect(status().isUnauthorized());
        mvc.perform(post(URL).contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"x\",\"shelfItemIds\":[1]}"))
                .andExpect(status().isUnauthorized());
        mvc.perform(patch(URL+"/"+id).contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"x\"}"))
                .andExpect(status().isUnauthorized());
        mvc.perform(post(URL + "/" + id + "/perfumes")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"shelfItemId\":1}"))
                .andExpect(status().isUnauthorized());
        mvc.perform(delete(URL + "/" + id + "/perfumes/1"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void shelfDeletionCannotLeaveEmptyCollection() throws Exception {
        long id = create("a");
        mvc.perform(delete("/api/v1/users/me/shelf-items/1")).andExpect(status().isNoContent());
        mvc.perform(delete("/api/v1/users/me/shelf-items/2")).andExpect(status().isConflict());
        mvc.perform(get(URL+"/"+id)).andExpect(jsonPath("$.perfumes.length()").value(1));
    }

    @TestConfiguration
    static class Config {
        @Bean @Primary FakeUser fakeUser() { return new FakeUser(); }
    }

    static class FakeUser implements CurrentUser {
        Long id;
        public Optional<Long> id() { return Optional.ofNullable(id); }
    }
}
