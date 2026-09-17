package com.hyanghae.backend.perfume.client;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hyanghae.backend.perfume.batch.ReviewAnalysisProperties;
import com.hyanghae.backend.perfume.repository.ReviewContent;
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
 * GMS 호출의 요청·응답 형식을 검증합니다.
 *
 * <p>가짜 요청 팩토리 대신 실제 HTTP 서버를 띄웁니다. 제한 시간을 위해 요청 팩토리를 직접
 * 지정하는데, 가짜 팩토리를 끼우면 그 지정이 덮여 검증 대상이 실제 코드와 달라집니다. JDK 의
 * {@link HttpServer} 라 의존성도 늘지 않습니다.
 */
class GmsReviewAnalyzerTest {

    private static final String REVIEW_TEXT = "처음에는 달콤하고 시간이 지나면 포근하게 남습니다.";
    private static final String SUMMARY_TEXT = "달콤한 잔향이 오래 남는다는 평가가 많습니다.";

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final List<String> receivedBodies = new ArrayList<>();

    private HttpServer server;
    private int responseStatus = 200;
    private String responseBody = "{}";

    @BeforeEach
    void startServer() throws IOException {
        server = HttpServer.create(new InetSocketAddress("localhost", 0), 0);
        server.createContext("/v1/chat/completions", exchange -> {
            receivedBodies.add(new String(
                    exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));

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

    /**
     * GMS 는 OpenAI 경로를 그대로 뚫어 주는 프록시라 요청 형식이 {@code /chat/completions} 규격입니다.
     *
     * <p>지시문의 역할이 {@code developer} 인지 함께 봅니다. GPT-5 계열이 쓰는 이름이고
     * {@code system} 은 그 이전 세대의 이름입니다.
     */
    @Test
    void sendsOpenAiCompatibleChatCompletionRequest() throws Exception {
        responseBody = chatResponse(summaryJson(SUMMARY_TEXT));

        analyzer(1000).summarize(List.of(new ReviewContent(1L, "제목", REVIEW_TEXT)));

        JsonNode request = objectMapper.readTree(receivedBodies.getFirst());
        assertThat(request.get("model").asText()).isEqualTo("gpt-5-nano");
        assertThat(request.get("response_format").get("type").asText()).isEqualTo("json_object");
        assertThat(request.get("messages").get(0).get("role").asText()).isEqualTo("developer");
        assertThat(request.get("messages").get(1).get("role").asText()).isEqualTo("user");

        JsonNode reviews = sentReviews(request);
        assertThat(reviews.get(0).get("reviewId").asLong()).isEqualTo(1L);
        assertThat(reviews.get(0).get("content").asText()).isEqualTo(REVIEW_TEXT);
    }

    /**
     * {@code temperature} 를 보내지 않습니다.
     *
     * <p>GPT-5 계열은 이 값을 기본값 외에는 받지 않고 400 으로 거절합니다. 값 하나가 무시되는
     * 문제가 아니라 호출 자체가 실패하므로, 다시 붙는 것을 이 단언으로 막습니다.
     */
    @Test
    void doesNotSendTemperature() throws Exception {
        responseBody = chatResponse(summaryJson(SUMMARY_TEXT));

        analyzer(1000).summarize(List.of(new ReviewContent(1L, null, REVIEW_TEXT)));

        JsonNode request = objectMapper.readTree(receivedBodies.getFirst());
        assertThat(request.has("temperature")).isFalse();
        assertThat(request.properties()).extracting(Map.Entry::getKey)
                .containsExactlyInAnyOrder("model", "messages", "response_format");
    }

    /**
     * 설정한 길이 제한이 지시문에 들어갑니다.
     *
     * <p>자리표시자와 인자가 어긋난 적이 있습니다. 지시문을 고치면서 자리표시자 수가 바뀌었는데
     * 인자는 그대로여서 값이 한 칸씩 밀렸습니다. 컴파일도 되고 호출도 되지만 지시문이 엉뚱해집니다.
     */
    @Test
    void putsConfiguredSummaryLengthIntoInstruction() throws Exception {
        responseBody = chatResponse(summaryJson(SUMMARY_TEXT));

        analyzer(1000).summarize(List.of(new ReviewContent(1L, null, REVIEW_TEXT)));

        assertThat(instructionOf(receivedBodies.getFirst())).contains("1000자를 넘기지 않습니다");
    }

    /**
     * 호평과 혹평을 함께 담게 합니다.
     *
     * <p>와이어프레임 A10 이 "호평·혹평 섞어 4문장까지"로 정해 두었습니다. 좋은 말만 모으면
     * 요약이 광고문이 되고, 화면이 후기를 대신 읽어 준다는 역할을 못 합니다.
     */
    @Test
    void asksForBothPraiseAndComplaint() throws Exception {
        responseBody = chatResponse(summaryJson(SUMMARY_TEXT));

        analyzer(1000).summarize(List.of(new ReviewContent(1L, null, REVIEW_TEXT)));

        assertThat(instructionOf(receivedBodies.getFirst()))
                .contains("호평과 혹평을 함께 담습니다")
                .contains("3~4문장");
    }

    /**
     * 키워드를 요구하지 않습니다.
     *
     * <p>화면의 요약 구역은 문장을 그대로 보여주고, 키워드 통계는 별개 구역입니다. 지시문에
     * 키워드가 남아 있으면 모델이 그것까지 만들어 출력이 길어지고 호출 시간이 늘어납니다.
     */
    @Test
    void doesNotAskForKeywords() throws Exception {
        responseBody = chatResponse(summaryJson(SUMMARY_TEXT));

        analyzer(1000).summarize(List.of(new ReviewContent(1L, null, REVIEW_TEXT)));

        assertThat(instructionOf(receivedBodies.getFirst())).doesNotContain("keywords");
    }

    /** 지시문에 "JSON" 이 있어야 {@code json_object} 응답 형식을 쓸 수 있습니다. */
    @Test
    void statesJsonOutputInInstruction() throws Exception {
        responseBody = chatResponse(summaryJson(SUMMARY_TEXT));

        analyzer(1000).summarize(List.of(new ReviewContent(1L, null, REVIEW_TEXT)));

        assertThat(instructionOf(receivedBodies.getFirst())).contains("JSON");
    }

    /** 긴 후기는 잘라서 보냅니다. 후기가 길수록 토큰이 늘고, 한 번의 호출 비용이 커집니다. */
    @Test
    void truncatesLongReviewContent() throws Exception {
        responseBody = chatResponse(summaryJson(SUMMARY_TEXT));

        analyzer(10).summarize(List.of(new ReviewContent(1L, null, "가".repeat(30))));

        JsonNode reviews = sentReviews(objectMapper.readTree(receivedBodies.getFirst()));
        assertThat(reviews.get(0).get("content").asText()).isEqualTo("가".repeat(10));
    }

    /** 모델 출력은 응답 본문 안에 문자열로 한 겹 더 들어 있습니다. */
    @Test
    void parsesSummaryFromModelOutput() throws Exception {
        responseBody = chatResponse(summaryJson(SUMMARY_TEXT));

        String summary = analyzer(1000).summarize(List.of(
                new ReviewContent(1L, null, REVIEW_TEXT),
                new ReviewContent(2L, null, REVIEW_TEXT)
        ));

        assertThat(summary).isEqualTo(SUMMARY_TEXT);
    }

    /** 요약 필드를 빼먹은 응답은 빈 값으로 다룹니다. 적재 여부의 판단은 배치가 합니다. */
    @Test
    void returnsNullWhenSummaryFieldIsMissing() throws Exception {
        responseBody = chatResponse("{}");

        String summary = analyzer(1000).summarize(List.of(new ReviewContent(1L, null, REVIEW_TEXT)));

        assertThat(summary).isNull();
    }

    /**
     * 오류 응답의 본문을 예외에 담지 않습니다.
     *
     * <p>일부 상용 API 는 오류 본문에 요청을 되돌려줍니다. 그대로 담으면 배치 실패 로그에 후기
     * 원문이 남습니다. 대응은 상태 코드만으로 갈립니다.
     */
    @Test
    void doesNotPutResponseBodyIntoExceptionWhenGmsReturnsError() {
        responseStatus = 429;
        responseBody = "{\"error\":{\"message\":\"" + REVIEW_TEXT + "\"}}";

        assertThatThrownBy(() ->
                analyzer(1000).summarize(List.of(new ReviewContent(1L, null, REVIEW_TEXT))))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("status=429")
                .hasMessageNotContaining(REVIEW_TEXT)
                .hasNoCause();
    }

    /** 해석하지 못한 출력도 예외 메시지에 담지 않습니다. 그 문자열이 후기 원문일 수 있습니다. */
    @Test
    void doesNotPutModelOutputIntoExceptionWhenOutputIsNotJson() throws Exception {
        responseBody = chatResponse("요약: " + REVIEW_TEXT);

        assertThatThrownBy(() ->
                analyzer(1000).summarize(List.of(new ReviewContent(1L, null, REVIEW_TEXT))))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageNotContaining(REVIEW_TEXT)
                .hasNoCause();
    }

    /** 응답 형태가 규격과 달라 모델 출력을 못 찾으면 실패로 다룹니다. */
    @Test
    void failsWhenResponseHasNoChoice() {
        responseBody = "{\"choices\":[]}";

        assertThatThrownBy(() ->
                analyzer(1000).summarize(List.of(new ReviewContent(1L, null, REVIEW_TEXT))))
                .isInstanceOf(IllegalStateException.class);
    }

    /** GMS 키는 Bearer 인증으로 보냅니다. 원래 API 의 인증 방식이 그대로입니다. */
    @Test
    void authenticatesWithBearerApiKey() throws Exception {
        responseBody = chatResponse(summaryJson(SUMMARY_TEXT));
        List<String> authorizations = new ArrayList<>();
        server.removeContext("/v1/chat/completions");
        server.createContext("/v1/chat/completions", exchange -> {
            authorizations.add(exchange.getRequestHeaders().getFirst("Authorization"));
            byte[] body = responseBody.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, body.length);
            exchange.getResponseBody().write(body);
            exchange.close();
        });

        analyzer(1000).summarize(List.of(new ReviewContent(1L, null, REVIEW_TEXT)));

        assertThat(authorizations).containsExactly("Bearer test-key");
    }

    /** 사용자 메시지에 담아 보낸 후기 배열입니다. 본문 안에 JSON 문자열로 한 겹 들어 있습니다. */
    private JsonNode sentReviews(JsonNode request) throws Exception {
        return objectMapper.readTree(request.get("messages").get(1).get("content").asText());
    }

    private String instructionOf(String requestBody) throws Exception {
        return objectMapper.readTree(requestBody)
                .get("messages").get(0).get("content").asText();
    }

    private String summaryJson(String summary) throws Exception {
        return objectMapper.writeValueAsString(Map.of("summary", summary));
    }

    private GmsReviewAnalyzer analyzer(int maxReviewLength) {
        return new GmsReviewAnalyzer(RestClient.builder(), objectMapper, properties(maxReviewLength));
    }

    private ReviewAnalysisProperties properties(int maxReviewLength) {
        return new ReviewAnalysisProperties(
                true,
                "0 10 * * * *",
                "Asia/Seoul",
                5,
                10,
                20,
                20,
                maxReviewLength,
                1000,
                new ReviewAnalysisProperties.Gms(
                        "http://localhost:" + server.getAddress().getPort() + "/v1",
                        "test-key",
                        "gpt-5-nano",
                        Duration.ofSeconds(2),
                        Duration.ofSeconds(5)
                )
        );
    }

    private String chatResponse(String content) throws Exception {
        return objectMapper.writeValueAsString(
                Map.of("choices", List.of(Map.of("message", Map.of("content", content)))));
    }
}
