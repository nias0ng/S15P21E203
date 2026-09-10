package com.hyanghae.backend.perfume.client;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hyanghae.backend.perfume.batch.ReviewAnalysisProperties;
import com.hyanghae.backend.perfume.repository.ReviewContent;
import com.hyanghae.backend.perfume.service.ReviewAnalyzer.AnalysisSource;
import com.hyanghae.backend.perfume.service.ReviewAnalyzer.ReviewAnalysis;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
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
        responseBody = chatResponse("""
                {"summary":"달콤합니다.","reviews":[{"reviewId":1,"keywords":["달콤한"]}]}
                """);

        analyzer(1000).analyze(source(new ReviewContent(1L, "제목", REVIEW_TEXT)));

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
        responseBody = chatResponse("{\"summary\":\"달콤합니다.\",\"reviews\":[]}");

        analyzer(1000).analyze(source(new ReviewContent(1L, null, REVIEW_TEXT)));

        JsonNode request = objectMapper.readTree(receivedBodies.getFirst());
        assertThat(request.has("temperature")).isFalse();
        assertThat(request.properties()).extracting(Map.Entry::getKey)
                .containsExactlyInAnyOrder("model", "messages", "response_format");
    }

    /**
     * 키워드를 뽑을 후기만 표시해서 보냅니다.
     *
     * <p>이미 키워드가 있는 후기는 요약의 근거로만 보냅니다. 다시 뽑으면 출력이 그만큼 길어져
     * 호출 시간과 비용만 늘고 결과는 대체로 같습니다. 그래도 요약은 전체를 읽어야 하므로 본문은
     * 함께 보냅니다.
     */
    @Test
    void marksOnlyKeywordTargetsAsNeedingKeywords() throws Exception {
        responseBody = chatResponse("{\"summary\":\"달콤합니다.\",\"reviews\":[]}");

        analyzer(1000).analyze(new AnalysisSource(
                List.of(
                        new ReviewContent(1L, null, REVIEW_TEXT),
                        new ReviewContent(2L, null, REVIEW_TEXT)
                ),
                Set.of(2L),
                List.of()
        ));

        JsonNode reviews = sentReviews(objectMapper.readTree(receivedBodies.getFirst()));
        assertThat(reviews.get(0).get("reviewId").asLong()).isEqualTo(1L);
        assertThat(reviews.get(0).get("needKeywords").asBoolean()).isFalse();
        assertThat(reviews.get(0).get("content").asText()).isEqualTo(REVIEW_TEXT);
        assertThat(reviews.get(1).get("reviewId").asLong()).isEqualTo(2L);
        assertThat(reviews.get(1).get("needKeywords").asBoolean()).isTrue();
    }

    /**
     * 이미 쓰인 표기를 지시문에 알려 줍니다.
     *
     * <p>새 후기만 보는 호출이라 지난번에 어떤 이름을 썼는지 모델이 알 수 없습니다. 알려 주지
     * 않으면 같은 표현에 다른 이름이 붙어("파우더" 와 "파우더리") 같은 뜻이 두 키워드로 갈라집니다.
     */
    @Test
    void tellsModelWhichKeywordNamesAreAlreadyUsed() throws Exception {
        responseBody = chatResponse("{\"summary\":\"달콤합니다.\",\"reviews\":[]}");

        analyzer(1000).analyze(new AnalysisSource(
                List.of(new ReviewContent(1L, null, REVIEW_TEXT)),
                Set.of(1L),
                List.of("달콤한", "파우더리")
        ));

        assertThat(instructionOf(receivedBodies.getFirst()))
                .contains("이미 쓰인 표기")
                .contains("달콤한, 파우더리");
    }

    /** 알려 줄 표기가 없으면 그 규칙을 아예 넣지 않습니다. 빈 목록을 주면 모델이 혼란스러워합니다. */
    @Test
    void omitsKnownKeywordRuleWhenNothingIsKnownYet() throws Exception {
        responseBody = chatResponse("{\"summary\":\"달콤합니다.\",\"reviews\":[]}");

        analyzer(1000).analyze(source(new ReviewContent(1L, null, REVIEW_TEXT)));

        assertThat(instructionOf(receivedBodies.getFirst())).doesNotContain("이미 쓰인 표기");
    }

    /** 지시문에 "JSON" 이 있어야 {@code json_object} 응답 형식을 쓸 수 있습니다. */
    @Test
    void statesJsonOutputInInstruction() throws Exception {
        responseBody = chatResponse("{\"summary\":\"달콤합니다.\",\"reviews\":[]}");

        analyzer(1000).analyze(source(new ReviewContent(1L, null, REVIEW_TEXT)));

        assertThat(instructionOf(receivedBodies.getFirst())).contains("JSON");
    }

    /** 긴 후기는 잘라서 보냅니다. 후기가 길수록 토큰이 늘고, 한 번의 호출 비용이 커집니다. */
    @Test
    void truncatesLongReviewContent() throws Exception {
        responseBody = chatResponse("{\"summary\":\"달콤합니다.\",\"reviews\":[]}");

        analyzer(10).analyze(source(new ReviewContent(1L, null, "가".repeat(30))));

        JsonNode reviews = sentReviews(objectMapper.readTree(receivedBodies.getFirst()));
        assertThat(reviews.get(0).get("content").asText()).isEqualTo("가".repeat(10));
    }

    /** 모델 출력은 응답 본문 안에 문자열로 한 겹 더 들어 있습니다. */
    @Test
    void parsesSummaryAndKeywordsFromModelOutput() throws Exception {
        responseBody = chatResponse("""
                {"summary":"달콤한 잔향이 오래 남습니다.",
                 "reviews":[{"reviewId":1,"keywords":["달콤한","포근한"]},
                            {"reviewId":2,"keywords":[]}]}
                """);

        ReviewAnalysis analysis = analyzer(1000).analyze(source(
                new ReviewContent(1L, null, REVIEW_TEXT),
                new ReviewContent(2L, null, REVIEW_TEXT)
        ));

        assertThat(analysis.summary()).isEqualTo("달콤한 잔향이 오래 남습니다.");
        assertThat(analysis.reviewKeywords()).hasSize(2);
        assertThat(analysis.reviewKeywords().getFirst().reviewId()).isEqualTo(1L);
        assertThat(analysis.reviewKeywords().getFirst().keywords())
                .containsExactly("달콤한", "포근한");
        assertThat(analysis.reviewKeywords().get(1).keywords()).isEmpty();
    }

    /** 키워드 목록을 아예 빼먹은 후기는 빈 목록으로 다룹니다. 값의 판단은 배치가 합니다. */
    @Test
    void treatsMissingKeywordListAsEmpty() throws Exception {
        responseBody = chatResponse("{\"summary\":\"달콤합니다.\",\"reviews\":[{\"reviewId\":1}]}");

        ReviewAnalysis analysis =
                analyzer(1000).analyze(source(new ReviewContent(1L, null, REVIEW_TEXT)));

        assertThat(analysis.reviewKeywords().getFirst().keywords()).isEmpty();
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
                analyzer(1000).analyze(source(new ReviewContent(1L, null, REVIEW_TEXT))))
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
                analyzer(1000).analyze(source(new ReviewContent(1L, null, REVIEW_TEXT))))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageNotContaining(REVIEW_TEXT)
                .hasNoCause();
    }

    /** 응답 형태가 규격과 달라 모델 출력을 못 찾으면 실패로 다룹니다. */
    @Test
    void failsWhenResponseHasNoChoice() {
        responseBody = "{\"choices\":[]}";

        assertThatThrownBy(() ->
                analyzer(1000).analyze(source(new ReviewContent(1L, null, REVIEW_TEXT))))
                .isInstanceOf(IllegalStateException.class);
    }

    /** GMS 키는 Bearer 인증으로 보냅니다. 원래 API 의 인증 방식이 그대로입니다. */
    @Test
    void authenticatesWithBearerApiKey() throws Exception {
        responseBody = chatResponse("{\"summary\":\"달콤합니다.\",\"reviews\":[]}");
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

        analyzer(1000).analyze(source(new ReviewContent(1L, null, REVIEW_TEXT)));

        assertThat(authorizations).containsExactly("Bearer test-key");
    }

    /** 준 후기 전체에서 키워드를 뽑는 경우입니다. 키워드가 아직 하나도 없는 향수의 첫 분석입니다. */
    private AnalysisSource source(ReviewContent... reviews) {
        List<ReviewContent> all = List.of(reviews);
        Set<Long> targets = all.stream()
                .map(ReviewContent::reviewId)
                .collect(Collectors.toCollection(LinkedHashSet::new));
        return new AnalysisSource(all, targets, List.of());
    }

    /** 사용자 메시지에 담아 보낸 후기 배열입니다. 본문 안에 JSON 문자열로 한 겹 들어 있습니다. */
    private JsonNode sentReviews(JsonNode request) throws Exception {
        return objectMapper.readTree(request.get("messages").get(1).get("content").asText());
    }

    private String instructionOf(String requestBody) throws Exception {
        return objectMapper.readTree(requestBody)
                .get("messages").get(0).get("content").asText();
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
                50,
                maxReviewLength,
                50,
                5,
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
