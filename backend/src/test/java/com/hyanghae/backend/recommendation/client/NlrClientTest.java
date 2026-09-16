package com.hyanghae.backend.recommendation.client;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hyanghae.backend.global.exception.BusinessException;
import com.hyanghae.backend.recommendation.exception.RecommendationErrorCode;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.client.RestClient;

/**
 * AI 서버 호출의 요청·응답 형식과 실패 처리를 검증합니다.
 *
 * <p>가짜 요청 팩토리 대신 실제 HTTP 서버를 띄웁니다. 제한 시간을 위해 요청 팩토리를 직접
 * 지정하는데, 가짜 팩토리를 끼우면 그 지정이 덮여 검증 대상이 실제 코드와 달라집니다. 제한
 * 시간이 실제로 걸리는지도 이 방식이라야 볼 수 있습니다. JDK 의 {@link HttpServer} 라
 * 의존성도 늘지 않습니다.
 */
class NlrClientTest {

    private static final String QUERY = "빨래 냄새 나는 향수 찾고 있어";
    private static final String RECOMMEND_PATH = "/nlr/recommend";

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final List<String> receivedBodies = new ArrayList<>();

    private HttpServer server;
    private int responseStatus = 200;
    private String responseBody = "{}";
    private long responseDelayMillis;

    @BeforeEach
    void startServer() throws IOException {
        server = HttpServer.create(new InetSocketAddress("localhost", 0), 0);
        server.createContext(RECOMMEND_PATH, exchange -> {
            receivedBodies.add(new String(
                    exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));

            if (responseDelayMillis > 0) {
                try {
                    Thread.sleep(responseDelayMillis);
                } catch (InterruptedException interrupted) {
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

    /**
     * 계약이 정한 요청 칸만 보냅니다.
     *
     * <p>{@code structured} 를 보내지 않는 것이 중요합니다. 비워 두면 AI 서버가 ①단계 LLM
     * 구조화를 스스로 부릅니다. 반대로 잘못된 모양을 보내면 AI 서버가 400 을 냅니다.
     */
    @Test
    void sendsOnlyTextAndTopK() throws Exception {
        responseBody = okResponse();

        client().recommend(QUERY);

        JsonNode request = objectMapper.readTree(receivedBodies.getFirst());
        assertThat(request.get("text").asText()).isEqualTo(QUERY);
        assertThat(request.get("topK").asInt()).isEqualTo(5);
        assertThat(request.properties()).hasSize(2);
    }

    /** 순위 순서 그대로 읽습니다. 추천은 순서가 곧 의미입니다. */
    @Test
    void readsResultsInOrder() {
        responseBody = okResponse();

        NlrRecommendResponse response = client().recommend(QUERY);

        assertThat(response.status()).isEqualTo("OK");
        assertThat(response.results())
                .extracting(NlrRecommendResponse.Result::fragranticaId)
                .containsExactly(73368L, 1234L);
    }

    /** 추천 이유의 재료인 {@code accord} 와 {@code from} 을 읽습니다. */
    @Test
    void readsMatchedAccordAndPhrase() {
        responseBody = okResponse();

        NlrRecommendResponse response = client().recommend(QUERY);

        assertThat(response.results().getFirst().matched())
                .extracting(NlrRecommendResponse.Matched::accord,
                        NlrRecommendResponse.Matched::from)
                .containsExactly(
                        org.assertj.core.api.Assertions.tuple("soapy", "빨래"),
                        org.assertj.core.api.Assertions.tuple("fresh", "빨래"));
    }

    /**
     * 쓰지 않는 칸이 와도 실패하지 않습니다.
     *
     * <p>{@code conditions}·{@code diagnostics}·{@code tier} 처럼 받지 않기로 한 칸이 응답에
     * 들어 있습니다. AI 가 칸을 더할 때마다 이쪽이 깨지면 두 저장소를 같이 배포해야 합니다.
     */
    @Test
    void ignoresFieldsItDoesNotUse() {
        responseBody = okResponse();

        NlrRecommendResponse response = client().recommend(QUERY);

        assertThat(response.results()).hasSize(2);
    }

    /**
     * AI 서버가 오류를 내면 503 도메인 에러로 바꿉니다.
     *
     * <p>상태 코드를 그대로 전달하지 않습니다. AI 서버의 400 은 사용자 잘못이 아니라 우리
     * 요청이 잘못된 것이라, 그대로 내보내면 화면이 사용자에게 엉뚱한 안내를 합니다.
     */
    @Test
    void translatesAiErrorIntoServiceUnavailable() {
        responseStatus = 500;
        responseBody = "{\"code\":\"NLR_NOT_READY\",\"message\":\"데이터를 아직 적재하지 못했습니다.\"}";

        assertThatThrownBy(() -> client().recommend(QUERY))
                .isInstanceOf(BusinessException.class)
                .satisfies(thrown -> assertThat(((BusinessException) thrown).errorCode())
                        .isEqualTo(RecommendationErrorCode.RECOMMENDATION_AI_UNAVAILABLE));
    }

    /**
     * 제한 시간을 넘기면 503 입니다.
     *
     * <p>제한 시간이 없으면 톰캣 스레드가 무한정 붙잡혀 추천과 무관한 요청까지 밀립니다.
     * "AI 서버가 죽어도 다른 기능은 살아 있어야 한다" 가 이 얘기입니다.
     */
    @Test
    void translatesTimeoutIntoServiceUnavailable() {
        responseBody = okResponse();
        responseDelayMillis = 400;

        assertThatThrownBy(() -> client(Duration.ofMillis(100)).recommend(QUERY))
                .isInstanceOf(BusinessException.class)
                .satisfies(thrown -> assertThat(((BusinessException) thrown).errorCode())
                        .isEqualTo(RecommendationErrorCode.RECOMMENDATION_AI_UNAVAILABLE));
    }

    /** 계약과 다른 응답도 503 입니다. {@code status} 가 없으면 화면이 분기할 수 없습니다. */
    @Test
    void translatesResponseWithoutStatusIntoServiceUnavailable() {
        responseBody = "{\"query\":\"" + QUERY + "\",\"results\":[]}";

        assertThatThrownBy(() -> client().recommend(QUERY))
                .isInstanceOf(BusinessException.class);
    }

    /**
     * 오류 메시지에 사용자가 쓴 문장도 AI 응답 본문도 담지 않습니다.
     *
     * <p>에러 응답과 예외 메시지는 그대로 로그에 남습니다. 사용자가 무엇을 찾고 있었는지는
     * 로그에 남길 내용이 아닙니다.
     */
    @Test
    void doesNotLeakQueryOrResponseBodyIntoException() {
        responseStatus = 400;
        responseBody = "{\"code\":\"NLR_INVALID_REQUEST\",\"message\":\"" + QUERY + " 가 틀렸습니다\"}";

        assertThatThrownBy(() -> client().recommend(QUERY))
                .isInstanceOf(BusinessException.class)
                .hasMessageNotContaining(QUERY)
                .hasMessageNotContaining("NLR_INVALID_REQUEST");
    }

    private NlrClient client() {
        return client(Duration.ofSeconds(5));
    }

    private NlrClient client(Duration readTimeout) {
        return new NlrClient(RestClient.builder(), new RecommendationProperties(
                5,
                new RecommendationProperties.Ai(
                        "http://localhost:" + server.getAddress().getPort(),
                        Duration.ofSeconds(2),
                        readTimeout
                )
        ));
    }

    /**
     * 계약서의 응답 예시를 그대로 씁니다.
     *
     * <p>받지 않기로 한 칸({@code conditions}·{@code unmatched}·{@code diagnostics} 와
     * {@code people}·{@code rating}·{@code score}·{@code strength}·{@code tier}·
     * {@code rationale})을 일부러 남겨 둡니다. 그 칸들이 와도 깨지지 않아야 합니다.
     */
    private String okResponse() {
        return """
                {
                  "status": "OK",
                  "query": "%s",
                  "conditions": {
                    "core": ["fresh", "soapy"], "avoid": [],
                    "matchedExpressions": ["빨래"], "source": "lexicon_only"
                  },
                  "results": [
                    {
                      "fragranticaId": 73368, "name": "Laundry",
                      "brand": "Ostrikov Beauty Publishing",
                      "people": 29, "rating": 4.17, "score": 193,
                      "matched": [
                        {"accord": "soapy", "strength": 100, "from": "빨래",
                         "tier": "TEAM", "rationale": "팀 문서의 생활 비유에…"},
                        {"accord": "fresh", "strength": 93, "from": "빨래",
                         "tier": "TEAM", "rationale": "같은 축이 뽀송한 을 함께 두고 있다."}
                      ]
                    },
                    {
                      "fragranticaId": 1234, "name": "Lazy Sunday Morning",
                      "brand": "Maison Martin Margiela",
                      "people": 60, "rating": 3.9, "score": 150,
                      "matched": [
                        {"accord": "fresh", "strength": 100, "from": "빨래",
                         "tier": "TEAM", "rationale": null}
                      ]
                    }
                  ],
                  "unmatched": [],
                  "diagnostics": {
                    "stage": "AND", "candidateCount": 518, "tieAtLast": 1,
                    "relaxed": [], "unmatchedHint": null
                  }
                }
                """.formatted(QUERY);
    }
}
