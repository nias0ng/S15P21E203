package com.hyanghae.backend.recommendation.client;

import java.util.List;

/**
 * AI 서버의 {@code POST /nlr/recommend} 응답입니다. <b>쓰는 칸만 받습니다.</b>
 *
 * <p>받지 않는 칸이 많습니다. {@code conditions}·{@code unmatched}·{@code diagnostics} 는
 * 문제를 볼 때 쓰는 내부 기록이고, 결과 안의 {@code people}·{@code rating}·{@code score} 와
 * {@code matched} 안의 {@code strength}·{@code tier}·{@code rationale} 도 마찬가지입니다.
 * 사용자에게 내보내지 않기로 계약서가 정했고, 여기서 받지 않으면 실수로 흘릴 일도 없습니다.
 *
 * <p>모르는 칸이 와도 실패하지 않습니다. Spring 이 만드는 {@code ObjectMapper} 는
 * {@code FAIL_ON_UNKNOWN_PROPERTIES} 가 꺼져 있습니다. AI 가 칸을 더해도 이쪽은 안 깨집니다.
 *
 * <p>이름과 브랜드도 받지 않습니다. AI 도 그 값을 갖고 있지만 <b>우리 DB 에서 꺼내야</b>
 * 합니다. AI 쪽 이름을 쓰면 DB 에 없는 향수도 이름만 채워 내보내게 되고, 그러면
 * {@code perfumeId} 가 없어 상세 페이지로 갈 수 없는 결과가 화면에 섞입니다.
 *
 * @param status  {@code OK}·{@code OK_RELAXED}·{@code NO_CONDITION}·{@code NO_RESULT} 넷입니다.
 * @param query   사용자가 쓴 말 그대로입니다.
 * @param results 향수 목록입니다. 순위 순서이고, <b>이 순서가 곧 의미입니다.</b>
 */
public record NlrRecommendResponse(String status, String query, List<Result> results) {

    /**
     * 추천된 향수 한 건입니다.
     *
     * @param fragranticaId Fragrantica 원본 향수 번호입니다. {@code perfumes.fragrantica_id}
     *                      와 같은 값이고, 이것으로 우리 DB 를 찾습니다.
     * @param matched       어느 향 조건에 맞았는지입니다. 추천 이유의 재료입니다.
     */
    public record Result(Long fragranticaId, List<Matched> matched) {
    }

    /**
     * 향수가 향 조건 하나에 맞았다는 기록입니다.
     *
     * @param accord 향 특성의 영어 이름입니다. <b>이 값을 그대로 사용자에게 보여주면 안 됩니다.</b>
     * @param from   사용자가 쓴 표현입니다. 화면의 {@code phrase} 가 이 값입니다.
     *               입력어와 무관한 근거면 {@code null} 입니다.
     */
    public record Matched(String accord, String from) {
    }
}
