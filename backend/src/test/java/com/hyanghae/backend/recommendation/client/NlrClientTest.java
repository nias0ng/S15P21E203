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
     * 계약서가 새로 실은 칸 여섯을 JSON 이름 그대로 읽습니다.
     *
     * <p><b>여기가 아니면 칸 이름이 틀려도 아무도 모릅니다.</b> 나머지 테스트는 자바 객체를
     * 직접 만들어 넣으므로 {@code @JsonProperty} 없이 이름만 어긋나도 전부 통과하고, 표에는
     * {@code NULL} 만 쌓입니다. 화면에 안 나가는 값이라 눈으로도 안 보입니다.
     */
    @Test
    void readsFieldsTheContractAdded() {
        responseBody = okResponse();

        NlrRecommendResponse response = client().recommend(QUERY);

        assertThat(response.lexiconVersion()).isEqualTo("v1_15");
        assertThat(response.promptSha256()).isEqualTo("4f0a368d98b41338");

        NlrRecommendResponse.Unmatched unmatched = response.unmatched().getFirst();
        assertThat(unmatched.expression()).isEqualTo("포근한 느낌");
        assertThat(unmatched.unmatchReason()).isEqualTo("NOT_CORE");
        assertThat(unmatched.entryId()).isEqualTo("kr.sens.cozy");
        assertThat(unmatched.hadConditions()).isTrue();
        assertThat(unmatched.llmAccords()).containsExactly("amber", "sweet", "vanilla");
        assertThat(unmatched.tier()).isEqualTo("LLM");
        assertThat(unmatched.resultCount()).isEqualTo(5);
    }

    /**
     * 향이 아닌 근거 {@code matchedData} 를 JSON 이름 그대로 읽습니다.
     *
     * <p><b>{@code results} 안이 아니라 최상위에 옵니다.</b> 추천 다섯 개에 똑같이 걸린
     * 조건이라 향수마다 반복하지 않습니다.
     */
    @Test
    void readsMatchedDataFromTheTopLevel() {
        responseBody = okResponse();

        NlrRecommendResponse response = client().recommend(QUERY);

        assertThat(response.matchedData())
                .extracting(NlrRecommendResponse.MatchedData::field,
                        NlrRecommendResponse.MatchedData::value,
                        NlrRecommendResponse.MatchedData::label,
                        NlrRecommendResponse.MatchedData::from,
                        NlrRecommendResponse.MatchedData::tier)
                .containsExactly(
                        org.assertj.core.api.Assertions.tuple(
                                "gender", "unisex", "중성적인", null, "DATA"),
                        org.assertj.core.api.Assertions.tuple(
                                "note", "mimosa", "미모사", "미모사", "DATA"));
    }

    /**
     * 향 조건이 없어 고른 응답을 읽습니다 — {@code stage} 가 {@code CONTEXT_ONLY} 입니다.
     *
     * <p><b>{@code matched} 가 비고 {@code matchedData} 만 찹니다.</b> 향 조건이 하나도
     * 없으므로 향으로 댈 근거가 없습니다. {@code status} 는 {@code OK_RELAXED} 라
     * 우리가 아는 네 값 그대로입니다.
     */
    @Test
    void readsContextOnlyResponse() {
        responseBody = contextOnlyResponse();

        NlrRecommendResponse response = client().recommend(QUERY);

        assertThat(response.status()).isEqualTo("OK_RELAXED");
        assertThat(response.diagnostics().stage()).isEqualTo("CONTEXT_ONLY");
        assertThat(response.conditions().core()).isEmpty();
        assertThat(response.results().getFirst().matched()).isEmpty();
        assertThat(response.matchedData())
                .extracting(NlrRecommendResponse.MatchedData::label)
                .containsExactly("중성적인");
    }

    /**
     * {@code llmAccords} 가 빈 배열이면 빈 목록으로 읽습니다. <b>{@code null} 이 아닙니다.</b>
     *
     * <p>빈 배열은 LLM 이 "향이 아니다" 라고 답한 것이고 {@code null} 은 묻지 않은 것입니다.
     * Jackson 이 여기서 둘을 뭉개면 표까지 뭉개진 채로 갑니다.
     */
    @Test
    void keepsEmptyAccordArrayDistinctFromNull() {
        responseBody = unmatchedAccordsResponse("[]");
        assertThat(client().recommend(QUERY).unmatched().getFirst().llmAccords())
                .isNotNull()
                .isEmpty();

        responseBody = unmatchedAccordsResponse("null");
        assertThat(client().recommend(QUERY).unmatched().getFirst().llmAccords())
                .isNull();
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
                ),
                new RecommendationProperties.RateLimit(Duration.ofMinutes(1), 30, 10, 120, 60)
        ));
    }

    /**
     * 계약서({@code ai/docs/nlr_api_contract.md})의 응답 예시를 그대로 씁니다.
     *
     * <p><b>여기가 JSON 칸 이름을 지키는 유일한 자리입니다.</b> 다른 테스트는 전부 자바
     * 객체를 직접 만들어 넣으므로, 칸 이름을 잘못 적어도 그쪽은 통과합니다. 계약서가 바뀌면
     * 이 문자열을 함께 고쳐야 합니다.
     *
     * <p>쓰지 않는 칸({@code people}·{@code rating}·{@code score}·{@code strength}·
     * {@code matched[].tier}·{@code rationale})은 일부러 남겨 둡니다. 그 칸들이 와도 깨지지
     * 않아야 합니다. {@code llmReasoning} 도 남겨 둡니다 — AI 는 안 보내지만, 보내더라도
     * 우리가 읽지 않는다는 것을 여기서 고정합니다.
     */
    private String okResponse() {
        return """
                {
                  "status": "OK",
                  "query": "%s",
                  "lexiconVersion": "v1_15",
                  "promptSha256": "4f0a368d98b41338",
                  "conditions": {
                    "core": ["fresh", "soapy"], "avoid": [],
                    "matchedExpressions": ["빨래"], "source": "lexicon_only"
                  },
                  "matchedData": [
                    {"field": "gender", "value": "unisex", "label": "중성적인",
                     "from": null, "tier": "DATA"},
                    {"field": "note", "value": "mimosa", "label": "미모사",
                     "from": "미모사", "tier": "DATA"}
                  ],
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
                  "unmatched": [
                    {"expression": "포근한 느낌", "normalizedKey": "포근한 느낌",
                     "unmatchReason": "NOT_CORE", "entryId": "kr.sens.cozy",
                     "hadConditions": true,
                     "llmAccords": ["amber", "sweet", "vanilla"],
                     "tier": "LLM", "resultCount": 5,
                     "llmReasoning": "AI 는 안 보내지만 와도 읽지 않는다"}
                  ],
                  "diagnostics": {
                    "stage": "AND", "candidateCount": 518, "tieAtLast": 1,
                    "relaxed": [], "unmatchedHint": null
                  }
                }
                """.formatted(QUERY);
    }

    /**
     * 향 조건 없이 성별로만 고른 응답입니다 (AI {@code S15P21E203-351}).
     *
     * <p>계약서의 {@code CONTEXT_ONLY} 예시를 그대로 씁니다. {@code core} 와 {@code matched}
     * 가 비어 있는 것이 이 경로의 특징입니다.
     */
    private String contextOnlyResponse() {
        return """
                {
                  "status": "OK_RELAXED",
                  "query": "%s",
                  "lexiconVersion": "v1_15",
                  "promptSha256": "4f0a368d98b41338",
                  "conditions": {
                    "core": [], "avoid": [],
                    "matchedExpressions": [], "source": "lexicon_only"
                  },
                  "matchedData": [
                    {"field": "gender", "value": "unisex", "label": "중성적인",
                     "from": null, "tier": "DATA"}
                  ],
                  "results": [
                    {"fragranticaId": 73368, "name": "Black Orchid",
                     "brand": "Tom Ford", "people": 31742, "rating": 3.9,
                     "score": 0, "matched": []}
                  ],
                  "unmatched": [],
                  "diagnostics": {
                    "stage": "CONTEXT_ONLY", "candidateCount": 21341,
                    "tieAtLast": 21341,
                    "relaxed": ["향 조건이 없어 성별·계절·낮밤·노트로만 골랐다"],
                    "unmatchedHint": null
                  }
                }
                """.formatted(QUERY);
    }

    /** {@code llmAccords} 만 바꿔 가며 보는 최소 응답입니다. */
    private String unmatchedAccordsResponse(String accordsJson) {
        return """
                {
                  "status": "NO_CONDITION",
                  "query": "%s",
                  "lexiconVersion": "v1_15",
                  "promptSha256": "4f0a368d98b41338",
                  "results": [],
                  "unmatched": [
                    {"expression": "저렴한 가격", "normalizedKey": "저렴한 가격",
                     "unmatchReason": "NOT_IN_LEXICON", "entryId": null,
                     "hadConditions": false, "llmAccords": %s,
                     "tier": "LLM", "resultCount": 0}
                  ]
                }
                """.formatted(QUERY, accordsJson);
    }
}
