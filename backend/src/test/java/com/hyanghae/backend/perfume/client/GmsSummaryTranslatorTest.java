package com.hyanghae.backend.perfume.client;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hyanghae.backend.perfume.batch.ReviewAnalysisProperties;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.client.RestClient;

/**
 * GMS 번역 호출의 요청 · 응답 형식을 검증합니다.
 *
 * <p>{@link GmsReviewAnalyzerTest} 와 같은 이유로 실제 HTTP 서버를 띄웁니다. 제한 시간을 요청
 * 팩토리로 직접 지정하는데, 가짜 팩토리를 끼우면 그 지정이 덮입니다.
 */
class GmsSummaryTranslatorTest {

    private static final String KOREAN = "상큼하게 시작한다는 평입니다.\n· 지속력: 짧다는 의견이 있습니다.";

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final List<String> receivedBodies = new ArrayList<>();

    private HttpServer server;
    private int responseStatus = 200;
    private String responseBody = "{}";
    private long responseDelayMillis = 0;

    @BeforeEach
    void startServer() throws IOException {
        server = HttpServer.create(new InetSocketAddress("localhost", 0), 0);
        server.createContext("/v1/chat/completions", exchange -> {
            receivedBodies.add(new String(
                    exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            if (responseDelayMillis > 0) {
                try {
                    Thread.sleep(responseDelayMillis);
                } catch (InterruptedException exception) {
                    Thread.currentThread().interrupt();
                }
            }

            byte[] body = responseBody.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(responseStatus, body.length);
            exchange.getResponseBody().write(body);
            exchange.close();
        });
        server.start();
    }

    @AfterEach
    void stopServer() {
        server.stop(0);
    }

    /** 한국어 요약을 줄 배열로 보내고, 받은 줄 배열을 줄바꿈으로 잇습니다. */
    @Test
    void sendsKoreanLinesAndJoinsEnglishLines() throws Exception {
        responseBody = chatResponse(payload("It opens fresh.", "· Longevity: Some say it is short."));

        String translated = translator("test-key", Duration.ofSeconds(5)).translateToEnglish(KOREAN);

        assertThat(translated).isEqualTo("It opens fresh.\n· Longevity: Some say it is short.");

        JsonNode request = objectMapper.readTree(receivedBodies.getFirst());
        assertThat(request.get("model").asText()).isEqualTo("gpt-5-nano");
        assertThat(request.get("response_format").get("type").asText()).isEqualTo("json_object");
        assertThat(request.get("messages").get(0).get("role").asText()).isEqualTo("developer");
        JsonNode sent = objectMapper.readTree(request.get("messages").get(1).get("content").asText());
        assertThat(sent.get("summary")).hasSize(2);
        assertThat(sent.get("summary").get(0).asText()).isEqualTo("상큼하게 시작한다는 평입니다.");
        assertThat(sent.get("summary").get(1).asText()).isEqualTo("· 지속력: 짧다는 의견이 있습니다.");
    }

    /** 지시문이 옮기기만 하고 줄을 지키라고 말합니다. 재요약이 아닙니다. */
    @Test
    void instructsLineByLineTranslation() throws Exception {
        responseBody = chatResponse(payload("It opens fresh."));

        translator("test-key", Duration.ofSeconds(5)).translateToEnglish(KOREAN);

        String instruction = objectMapper.readTree(receivedBodies.getFirst())
                .get("messages").get(0).get("content").asText();
        assertThat(instruction).contains("Translate only", "same number of lines", "JSON", "Dry-down");
    }

    /** 키가 없으면 꺼져 있습니다. 부르는 쪽이 한국어로 되돌아갑니다. */
    @Test
    void isDisabledWithoutApiKey() {
        assertThat(translator("", Duration.ofSeconds(5)).isEnabled()).isFalse();
        assertThat(translator("  ", Duration.ofSeconds(5)).isEnabled()).isFalse();
        assertThat(translator("test-key", Duration.ofSeconds(5)).isEnabled()).isTrue();
    }

    /** 오류 응답은 상태 코드만 담은 예외입니다. 본문에 요약이 되돌아와도 메시지에 남지 않습니다. */
    @Test
    void failsWithStatusOnlyOnErrorResponse() {
        responseStatus = 500;
        responseBody = "{\"error\":\"상큼하게 시작한다는 평입니다.\"}";

        assertThatThrownBy(() -> translator("test-key", Duration.ofSeconds(5)).translateToEnglish(KOREAN))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("status=500")
                .hasMessageNotContaining("상큼");
    }

    /** 약속한 JSON 이 아니거나 빈 번역이면 예외입니다. 빈 영어를 화면에 내보내지 않습니다. */
    @Test
    void failsOnMalformedOrEmptyOutput() throws Exception {
        responseBody = chatResponse("not json 상큼");
        assertThatThrownBy(() -> translator("test-key", Duration.ofSeconds(5)).translateToEnglish(KOREAN))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageNotContaining("상큼");

        responseBody = chatResponse(payload("", " "));
        assertThatThrownBy(() -> translator("test-key", Duration.ofSeconds(5)).translateToEnglish(KOREAN))
                .isInstanceOf(IllegalStateException.class);
    }

    /** 제한 시간을 넘기면 기다리지 않고 실패합니다. */
    @Test
    void failsWhenResponseIsSlowerThanReadTimeout() throws Exception {
        responseBody = chatResponse(payload("It opens fresh."));
        responseDelayMillis = 1500;

        assertThatThrownBy(() -> translator("test-key", Duration.ofMillis(300)).translateToEnglish(KOREAN))
                .isInstanceOf(RuntimeException.class);
    }

    private GmsSummaryTranslator translator(String apiKey, Duration readTimeout) {
        ReviewAnalysisProperties analysis = new ReviewAnalysisProperties(
                false,
                "0 10 * * * *",
                "Asia/Seoul",
                5,
                10,
                20,
                20,
                1000,
                1000,
                new ReviewAnalysisProperties.Gms(
                        "http://localhost:" + server.getAddress().getPort() + "/v1",
                        apiKey,
                        "gpt-5-nano",
                        Duration.ofSeconds(2),
                        Duration.ofSeconds(120)
                )
        );
        return new GmsSummaryTranslator(
                RestClient.builder(),
                objectMapper,
                analysis,
                new SummaryTranslationProperties(Duration.ofSeconds(2), readTimeout)
        );
    }

    private String payload(String... lines) throws Exception {
        return objectMapper.writeValueAsString(Map.of("summary", List.of(lines)));
    }

    private String chatResponse(String content) throws Exception {
        return objectMapper.writeValueAsString(
                Map.of("choices", List.of(Map.of("message", Map.of("content", content)))));
    }
}
