package com.hyanghae.backend.recommendation.client;

import com.hyanghae.backend.global.exception.BusinessException;
import com.hyanghae.backend.recommendation.exception.RecommendationErrorCode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;

/**
 * 자연어 추천 AI 서버를 부릅니다.
 *
 * <p>NLR 은 자연어 추천(Natural Language Recommendation)입니다. 한국어 문장을 향 조건으로
 * 바꾸고 향수 13만 개에서 찾는 일을 Python 서버가 맡습니다. 계약은
 * {@code ai/docs/nlr_api_contract.md} 에 있습니다.
 *
 * <p>이 서버는 외부에 열려 있지 않습니다. 인증도 호출량 제한도 없으므로
 * <b>여기까지 도달한 요청은 이미 검증된 것이어야 합니다.</b>
 *
 * <p>AI 서버의 모든 실패를 하나의 도메인 에러로 바꿉니다. 호출한 쪽이 알아야 하는 것은
 * "지금 추천을 못 한다" 하나뿐이고, 상태 코드별로 다르게 대응할 방법이 없습니다.
 */
@Component
public class NlrClient {

    private static final Logger log = LoggerFactory.getLogger(NlrClient.class);

    private static final String RECOMMEND_PATH = "/nlr/recommend";

    private final RestClient restClient;
    private final RecommendationProperties properties;

    public NlrClient(RestClient.Builder restClientBuilder, RecommendationProperties properties) {
        RecommendationProperties.Ai ai = properties.ai();
        this.restClient = restClientBuilder
                .baseUrl(ai.baseUrl())
                .requestFactory(requestFactory(ai))
                .build();
        this.properties = properties;
    }

    /**
     * 문장 하나로 향수를 찾습니다.
     *
     * <p>{@code text} 는 이미 1~500자로 검증돼 있어야 합니다. AI 서버도 같은 범위를 강제하지만
     * 거기까지 가서 400 을 받는 것은 낭비입니다.
     *
     * @throws BusinessException AI 서버가 응답하지 않거나 오류를 냈습니다. 503 으로 나갑니다.
     */
    public NlrRecommendResponse recommend(String text) {
        NlrRecommendRequest request = new NlrRecommendRequest(text, properties.topK());

        NlrRecommendResponse response = call(request);
        if (response == null || response.status() == null) {
            log.error("AI 서버 응답이 계약과 다릅니다: path={}", RECOMMEND_PATH);
            throw new BusinessException(RecommendationErrorCode.RECOMMENDATION_AI_UNAVAILABLE);
        }
        return response;
    }

    /**
     * 제한 시간을 직접 정합니다.
     *
     * <p>기본 요청 팩토리는 제한 시간이 없습니다. AI 서버가 응답하지 않으면 톰캣 스레드가
     * 무한정 붙잡히고, 그러면 <b>추천과 무관한 다른 요청까지 밀립니다.</b> 계약서가
     * "AI 서버가 죽어도 다른 기능은 살아 있어야 한다" 고 정한 것이 이 얘기입니다.
     */
    private static SimpleClientHttpRequestFactory requestFactory(RecommendationProperties.Ai ai) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout((int) ai.connectTimeout().toMillis());
        factory.setReadTimeout((int) ai.readTimeout().toMillis());
        return factory;
    }

    /**
     * 오류의 본문도 사용자가 쓴 문장도 로그와 예외에 담지 않습니다.
     *
     * <p>AI 서버의 오류 본문에는 어느 칸이 왜 틀렸는지가 들어 있고, 요청 본문에는 사용자가 쓴
     * 원문이 들어 있습니다. 둘 다 로그에 남으면 안 됩니다. 상태 코드와 예외 종류만으로 대응은
     * 충분히 갈립니다.
     *
     * <p>{@link ResourceAccessException} 을 따로 잡는 이유는 그것만 원인이 다르기 때문입니다.
     * AI 서버가 오류를 <b>낸</b> 것이 아니라 <b>닿지 않은</b> 것이라, 배포에서 봐야 할 곳이
     * 다릅니다.
     */
    private NlrRecommendResponse call(NlrRecommendRequest request) {
        try {
            return restClient.post()
                    .uri(RECOMMEND_PATH)
                    .body(request)
                    .retrieve()
                    .body(NlrRecommendResponse.class);
        } catch (ResourceAccessException exception) {
            log.error("AI 서버에 닿지 못했습니다: path={}, exceptionType={}",
                    RECOMMEND_PATH, exception.getClass().getSimpleName());
            throw new BusinessException(RecommendationErrorCode.RECOMMENDATION_AI_UNAVAILABLE);
        } catch (RestClientResponseException exception) {
            log.error("AI 서버가 오류를 냈습니다: path={}, status={}",
                    RECOMMEND_PATH, exception.getStatusCode().value());
            throw new BusinessException(RecommendationErrorCode.RECOMMENDATION_AI_UNAVAILABLE);
        } catch (RestClientException exception) {
            log.error("AI 서버 호출이 실패했습니다: path={}, exceptionType={}",
                    RECOMMEND_PATH, exception.getClass().getSimpleName());
            throw new BusinessException(RecommendationErrorCode.RECOMMENDATION_AI_UNAVAILABLE);
        }
    }
}
