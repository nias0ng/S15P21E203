package com.hyanghae.backend.recommendation.client;

import java.util.List;

/**
 * AI 서버의 {@code POST /nlr/recommend} 응답입니다.
 *
 * <p>화면에 나가는 것은 {@code status} 와 {@code results} 뿐입니다. 나머지 셋은
 * <b>기록용</b>입니다 — 어떤 조건으로 무엇을 골랐는지, 사전이 무엇을 못 받았는지를
 * {@code nlr_*} 표에 남깁니다. 남기지 않으면 사전을 무엇으로 넓힐지 정할 근거가 없습니다.
 *
 * <p>모르는 칸은 Jackson 이 무시합니다. AI 가 계약을 넓혀도 이 record 를 고치기 전까지는
 * 그냥 버려지고, 고치면 그때부터 읽힙니다.
 */
public record NlrRecommendResponse(
        String status,
        String query,
        Conditions conditions,
        List<Result> results,
        List<Unmatched> unmatched,
        Diagnostics diagnostics
) {

    /**
     * AI 가 문장에서 뽑아낸 향 조건입니다.
     *
     * @param core   원하는 향 특성입니다.
     * @param avoid  피하고 싶은 향 특성입니다.
     * @param source {@code lexicon_only} · {@code llm+lexicon} · {@code llm_no_effect}.
     *               조건이 사전만으로 나왔는지 LLM 이 거들었는지 가릅니다.
     */
    public record Conditions(
            List<String> core,
            List<String> avoid,
            List<String> matchedExpressions,
            String source
    ) {
    }

    /**
     * @param fragranticaId Fragrantica 원본 향수 번호입니다. {@code perfumes.fragrantica_id}
     *                      로 우리 번호를 찾아야 합니다.
     */
    public record Result(Long fragranticaId, List<Matched> matched) {
    }

    public record Matched(String accord, String from) {
    }

    /**
     * 사전이 받지 못한 표현 하나입니다.
     *
     * <p><b>지금 오는 칸은 넷뿐입니다.</b> 표에는 {@code hadConditions} · {@code llmAccords} ·
     * {@code tier} 같은 칸이 더 있지만 AI 계약이 아직 그것을 보내지 않아 {@code NULL} 로
     * 남습니다. 계약이 넓어지면 여기에 칸을 더하면 됩니다.
     */
    public record Unmatched(
            String expression,
            String normalizedKey,
            String unmatchReason,
            String entryId
    ) {
    }

    /**
     * @param stage          어느 단계에서 답이 나왔는지입니다. {@code AND} · {@code RELAXED_OR}
     *                       처럼 조건을 얼마나 풀었는지가 담깁니다.
     * @param candidateCount 다섯 개를 고르기 전의 후보 규모입니다.
     */
    public record Diagnostics(
            String stage,
            Integer candidateCount,
            Integer tieAtLast,
            List<String> relaxed,
            String unmatchedHint
    ) {
    }
}
