package com.hyanghae.backend.recommendation.client;

import java.util.List;

/**
 * AI 서버의 {@code POST /nlr/recommend} 응답입니다.
 *
 * <p>화면에 나가는 것은 {@code status} 와 {@code results} 뿐입니다. 나머지는 <b>기록용</b>입니다
 * — 어떤 조건으로 무엇을 골랐는지, 사전이 무엇을 못 받았는지, 그리고 <b>그것이 어느 판에서
 * 나왔는지</b>를 {@code nlr_*} 표에 남깁니다. 남기지 않으면 사전을 무엇으로 넓힐지 정할
 * 근거가 없습니다.
 *
 * <p>모르는 칸은 Jackson 이 무시합니다. AI 가 계약을 넓혀도 이 record 를 고치기 전까지는
 * 그냥 버려지고, 고치면 그때부터 읽힙니다.
 *
 * @param lexiconVersion 엔진이 쓴 향 사전 버전입니다. {@code "v1_15"} 처럼 사람이 읽는
 *                       값이고 {@code nlr_recommendations.lexicon_version} 에 그대로
 *                       들어갑니다.
 *                       <p><b>{@code null} 일 수 있습니다.</b> 사전 파일 이름이 규칙에 맞지
 *                       않으면(측정용 임시 파일 등) AI 가 {@code null} 을 보냅니다. 그 {@code
 *                       null} 은 "없다" 가 아니라 <b>"모른다"</b> 이므로 추측해서 채우면 안
 *                       됩니다. 틀린 값은 칸이 비어 있는 것보다 나쁩니다 — 비어 있으면 모른다는
 *                       것을 알지만, 틀리면 아는 줄 착각합니다.
 * @param promptSha256   ①단계 프롬프트 지문의 앞 16자입니다. ⑤단계 추정 프롬프트는 별개이고
 *                       아직 응답에 실리지 않습니다. 프롬프트 파일을 못 읽으면 {@code null}
 *                       이고, 뜻은 {@code lexiconVersion} 과 같습니다.
 */
public record NlrRecommendResponse(
        String status,
        String query,
        String lexiconVersion,
        String promptSha256,
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
     * <p>뒤의 네 칸은 표현 하나의 성질이 아니라 <b>그 요청 전체의 값</b>인데, 표가 표현마다
     * 한 줄씩 갖도록 설계돼 있어 AI 가 줄마다 붙여 보냅니다.
     *
     * <p>{@code llmReasoning} 은 받지 않습니다. 표에는 칸이 있지만 AI 가 일부러 보내지
     * 않습니다 — LLM 이 매핑한 <b>뒤에 붙인 설명</b>이지 근거가 아니고, 실측에서 없는 말을
     * 지어냈습니다. 받지 않으면 화면으로 새어 나갈 길도 생기지 않습니다. 분석이 필요하면
     * AI 서버의 파일 로그에 그대로 남아 있습니다.
     *
     * @param hadConditions 그 요청이 향 조건을 하나라도 뽑았는지입니다. AI 가 아직 보내지
     *                      않던 때의 기록이 있어 {@code null} 일 수 있습니다.
     * @param llmAccords    ⑤단계 LLM 이 추정한 accord 들입니다.
     *                      <p><b>빈 목록과 {@code null} 이 다릅니다.</b> 빈 목록은 LLM 이
     *                      "이건 향이 아니다" 라고 답한 것(가격 · 성별 · 지속력 같은 것)이고,
     *                      {@code null} 은 <b>묻지 않은 것</b>입니다(⑤단계가 꺼졌거나 조건이
     *                      이미 있었음). 둘을 뭉개면 "향이 아니라고 답한 것" 과 "안 물어본 것"
     *                      을 셀 수 없습니다. 표 주석에도 같은 말이 적혀 있습니다.
     * @param tier          {@code "LLM"} 또는 {@code null} 입니다. 사전 경로와 LLM 경로를
     *                      가릅니다.
     * @param resultCount   그 요청이 실제로 낸 추천 개수입니다. <b>추정을 물어봤을 때만</b>
     *                      값이 있습니다 — 안 물어본 표현에도 개수를 적으면 "추정이 결과를
     *                      만들었나" 를 셀 수 없습니다.
     */
    public record Unmatched(
            String expression,
            String normalizedKey,
            String unmatchReason,
            String entryId,
            Boolean hadConditions,
            List<String> llmAccords,
            String tier,
            Integer resultCount
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
