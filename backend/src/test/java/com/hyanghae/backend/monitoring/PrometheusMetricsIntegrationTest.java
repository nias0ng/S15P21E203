package com.hyanghae.backend.monitoring;

import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@SpringBootTest(
        classes = {
                MetricsTestApplication.class,
                PrometheusMetricsIntegrationTest.TestController.class
        },
        properties = "spring.autoconfigure.exclude="
                + "org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration,"
                + "org.springframework.boot.autoconfigure.orm.jpa.HibernateJpaAutoConfiguration,"
                + "org.springframework.boot.autoconfigure.flyway.FlywayAutoConfiguration,"
                + "org.springframework.boot.autoconfigure.data.redis.RedisAutoConfiguration,"
                + "org.springframework.boot.autoconfigure.data.redis.RedisRepositoriesAutoConfiguration"
)
@AutoConfigureMockMvc
@ActiveProfiles("prod")
class PrometheusMetricsIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void exposesHttpRequestMetricsForPrometheusScraping() throws Exception {
        mockMvc.perform(get("/test"))
                .andExpect(status().isOk());

        mockMvc.perform(get("/actuator/prometheus"))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("http_server_requests_seconds_count")))
                .andExpect(content().string(containsString("http_server_requests_seconds_bucket")))
                .andExpect(content().string(containsString("application=\"backend\"")))
                .andExpect(content().string(containsString("environment=\"prod\"")));
    }

    @RestController
    static class TestController {

        @GetMapping("/test")
        String test() {
            return "ok";
        }
    }
}
