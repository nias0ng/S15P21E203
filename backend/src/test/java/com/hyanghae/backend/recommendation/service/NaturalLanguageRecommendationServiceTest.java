package com.hyanghae.backend.recommendation.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import com.hyanghae.backend.perfume.repository.PerfumeIdentity;
import com.hyanghae.backend.perfume.repository.PerfumeImageRepository;
import com.hyanghae.backend.perfume.repository.PerfumeImageUrl;
import com.hyanghae.backend.perfume.repository.PerfumeRepository;
import com.hyanghae.backend.recommendation.client.NlrClient;
import com.hyanghae.backend.recommendation.client.NlrRecommendResponse;
import com.hyanghae.backend.global.security.CurrentUser;
import com.hyanghae.backend.recommendation.dto.response.NaturalLanguageRecommendationResponse;
import com.hyanghae.backend.recommendation.dto.response.RecommendationDataResponse;
import com.hyanghae.backend.recommendation.dto.response.RecommendationReasonResponse;
import com.hyanghae.backend.recommendation.dto.response.RecommendedPerfumeResponse;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;

/**
 * AI 응답을 화면이 쓸 모양으로 바꾸는 규칙만 떼어 검증합니다.
 *
 * <p>데이터베이스 없이 봅니다. 여기서 볼 것은 "AI 가 준 것을 어떻게 다시 세우는가" 이고, 그
 * 판단에 데이터베이스는 조회 결과를 주는 역할뿐입니다. 실제 조회가 되는지는
 * {@code NaturalLanguageRecommendationIntegrationTest} 가 봅니다.
 *
 * <p>특히 <b>순서</b>와 <b>DB 에 없는 향수</b>를 봅니다. 둘 다 조회를 대역으로 바꿔야 만들 수
 * 있는 상황입니다 — 실제 조회는 순서를 보장하지 않고(그래서 어긋난 순서를 일부러 돌려줍니다),
 * 13만 적재가 끝난 DB 에서는 없는 향수를 만들기 어렵습니다.
 */
class NaturalLanguageRecommendationServiceTest {

    private static final String QUERY = "빨래 냄새 나는 향수 찾고 있어";
    private static final String THUMBNAIL = "https://img.example.com/laundry.jpg";

    private final NlrClient nlrClient = mock(NlrClient.class);
    private final PerfumeRepository perfumeRepository = mock(PerfumeRepository.class);
    private final PerfumeImageRepository perfumeImageRepository = mock(PerfumeImageRepository.class);
    private final NlrRecordService recordService = mock(NlrRecordService.class);
    private final CurrentUser currentUser = Optional::<Long>empty;

    private final NaturalLanguageRecommendationService service =
            new NaturalLanguageRecommendationService(
                    nlrClient, recordService, currentUser,
                    perfumeRepository, perfumeImageRepository, new AccordLabeler());

    /**
     * AI 가 정한 순위를 그대로 지킵니다.
     *
     * <p>{@code IN} 절 조회는 보낸 순서를 지키지 않습니다. 그 상황을 만들려고 조회 대역이
     * 일부러 뒤집힌 순서로 돌려줍니다. 추천은 순위가 곧 의미라 여기서 어긋나면 결과가 달라집니다.
     */
    @Test
    void keepsRankingOrderDecidedByAi() {
        given(nlrClient.recommend(QUERY)).willReturn(aiResponse("OK",
                result(73368L, matched("soapy", "빨래")),
                result(1234L, matched("fresh", "빨래")),
                result(5678L, matched("aldehydic", "빨래"))));
        given(perfumeRepository.findIdentitiesByFragranticaIds(anyCollection()))
                .willReturn(List.of(
                        identity(5678L, 3L, "Third", "브랜드"),
                        identity(73368L, 1L, "First", "브랜드"),
                        identity(1234L, 2L, "Second", "브랜드")));

        NaturalLanguageRecommendationResponse response = service.recommend(QUERY);

        assertThat(response.perfumes())
                .extracting(RecommendedPerfumeResponse::perfumeId)
                .containsExactly(1L, 2L, 3L);
    }

    /**
     * 우리 DB 에 없는 향수는 목록에서 빠집니다.
     *
     * <p>{@code perfumeId} 를 채울 수 없습니다. 못 채운 채 이름만 내보내면 눌러도 아무 데도
     * 가지 않는 카드가 화면에 섞입니다.
     */
    @Test
    void dropsPerfumesMissingFromDatabase() {
        given(nlrClient.recommend(QUERY)).willReturn(aiResponse("OK",
                result(73368L, matched("soapy", "빨래")),
                result(99999L, matched("fresh", "빨래"))));
        given(perfumeRepository.findIdentitiesByFragranticaIds(anyCollection()))
                .willReturn(List.of(identity(73368L, 1L, "Laundry", "브랜드")));

        NaturalLanguageRecommendationResponse response = service.recommend(QUERY);

        assertThat(response.perfumes())
                .extracting(RecommendedPerfumeResponse::perfumeId)
                .containsExactly(1L);
        assertThat(response.status()).isEqualTo("OK");
    }

    /**
     * 보여줄 향수가 하나도 안 남으면 {@code NO_RESULT} 로 내립니다.
     *
     * <p>AI 는 자기 데이터 13만 개에서 찾아 {@code OK} 를 주지만 우리 DB 에 없으면 화면에
     * 아무것도 못 띄웁니다. {@code OK} 인데 빈 배열이면 프론트가 분기할 방법이 없습니다.
     */
    @Test
    void downgradesToNoResultWhenNothingIsLeftToShow() {
        given(nlrClient.recommend(QUERY)).willReturn(aiResponse("OK",
                result(99999L, matched("soapy", "빨래"))));
        given(perfumeRepository.findIdentitiesByFragranticaIds(anyCollection()))
                .willReturn(List.of());

        NaturalLanguageRecommendationResponse response = service.recommend(QUERY);

        assertThat(response.status()).isEqualTo("NO_RESULT");
        assertThat(response.perfumes()).isEmpty();
    }

    /**
     * {@code NO_CONDITION} 은 내리지 않습니다.
     *
     * <p>향 조건 자체를 못 뽑은 것이라 원인이 다르고 화면이 할 말도 다릅니다. 조회도 하지
     * 않습니다 — 찾을 향수가 없습니다.
     */
    @Test
    void keepsNoConditionAsIs() {
        given(nlrClient.recommend(QUERY)).willReturn(aiResponse("NO_CONDITION"));

        NaturalLanguageRecommendationResponse response = service.recommend(QUERY);

        assertThat(response.status()).isEqualTo("NO_CONDITION");
        assertThat(response.perfumes()).isEmpty();
        verify(perfumeRepository, never()).findIdentitiesByFragranticaIds(anyCollection());
    }

    /**
     * 사용자가 쓴 표현별로 향 특성을 묶습니다.
     *
     * <p>같은 표현에서 나온 향 특성이 여럿이면 한 줄로 잇습니다. 표현이 다르면 줄을 나눕니다.
     */
    @Test
    void groupsReasonsByUserPhrase() {
        given(nlrClient.recommend(QUERY)).willReturn(aiResponse("OK",
                result(73368L,
                        matched("soapy", "빨래"),
                        matched("fresh", "빨래"),
                        matched("woody", "나무"))));
        given(perfumeRepository.findIdentitiesByFragranticaIds(anyCollection()))
                .willReturn(List.of(identity(73368L, 1L, "Laundry", "브랜드")));

        NaturalLanguageRecommendationResponse response = service.recommend(QUERY);

        assertThat(response.perfumes().getFirst().reasons())
                .extracting(RecommendationReasonResponse::phrase,
                        RecommendationReasonResponse::evidence)
                .containsExactly(
                        tuple("빨래", "soapy · fresh"),
                        tuple("나무", "woody"));
    }

    /**
     * 입력어와 무관한 근거는 {@code phrase} 가 {@code null} 입니다.
     *
     * <p>계약이 허용하는 값이고 화면은 그때 표현 없이 이유만 보여줍니다.
     */
    @Test
    void keepsReasonWithoutPhrase() {
        given(nlrClient.recommend(QUERY)).willReturn(aiResponse("OK",
                result(73368L, matched("soapy", null))));
        given(perfumeRepository.findIdentitiesByFragranticaIds(anyCollection()))
                .willReturn(List.of(identity(73368L, 1L, "Laundry", "브랜드")));

        NaturalLanguageRecommendationResponse response = service.recommend(QUERY);

        assertThat(response.perfumes().getFirst().reasons())
                .containsExactly(new RecommendationReasonResponse(null, "soapy"));
    }

    /**
     * 추천 이유는 3개까지입니다. 계약이 1~3개로 정했습니다.
     *
     * <p>뒤에서 자릅니다. AI 가 주는 순서가 세기 순이라 앞쪽이 더 크게 걸린 이유입니다.
     */
    @Test
    void keepsAtMostThreeReasons() {
        given(nlrClient.recommend(QUERY)).willReturn(aiResponse("OK",
                result(73368L,
                        matched("soapy", "빨래"),
                        matched("woody", "나무"),
                        matched("citrus", "상큼"),
                        matched("powdery", "포근"))));
        given(perfumeRepository.findIdentitiesByFragranticaIds(anyCollection()))
                .willReturn(List.of(identity(73368L, 1L, "Laundry", "브랜드")));

        NaturalLanguageRecommendationResponse response = service.recommend(QUERY);

        assertThat(response.perfumes().getFirst().reasons())
                .extracting(RecommendationReasonResponse::phrase)
                .containsExactly("빨래", "나무", "상큼");
    }

    /**
     * 한국어 이름이 있으면 한국어로, 없으면 영어로 내보냅니다.
     *
     * <p>{@code perfumes.name_ko} 가 아직 대부분 비어 있어 지금은 영어가 나갑니다. 채워지면
     * 응답이 저절로 한국어로 바뀌어야 합니다.
     */
    @Test
    void prefersKoreanNameWhenPresent() {
        given(nlrClient.recommend(QUERY)).willReturn(aiResponse("OK",
                result(1L, matched("soapy", "빨래")),
                result(2L, matched("soapy", "빨래"))));
        given(perfumeRepository.findIdentitiesByFragranticaIds(anyCollection()))
                .willReturn(List.of(
                        new PerfumeIdentity(1L, 11L, "Lazy Sunday Morning", "레이지 선데이 모닝",
                                "Maison Martin Margiela", "메종 마르지엘라"),
                        new PerfumeIdentity(2L, 22L, "Laundry", null,
                                "Ostrikov Beauty Publishing", "  ")));

        NaturalLanguageRecommendationResponse response = service.recommend(QUERY);

        assertThat(response.perfumes())
                .extracting(RecommendedPerfumeResponse::name, RecommendedPerfumeResponse::brand)
                .containsExactly(
                        tuple("레이지 선데이 모닝", "메종 마르지엘라"),
                        tuple("Laundry", "Ostrikov Beauty Publishing"));
    }

    /** 대표 이미지가 있으면 채우고, 없는 향수는 {@code null} 입니다. */
    @Test
    void fillsThumbnailOnlyWhenImageExists() {
        given(nlrClient.recommend(QUERY)).willReturn(aiResponse("OK",
                result(1L, matched("soapy", "빨래")),
                result(2L, matched("soapy", "빨래"))));
        given(perfumeRepository.findIdentitiesByFragranticaIds(anyCollection()))
                .willReturn(List.of(
                        identity(1L, 11L, "With Image", "브랜드"),
                        identity(2L, 22L, "Without Image", "브랜드")));
        given(perfumeImageRepository.findOrderedByPerfumeIds(anyCollection()))
                .willReturn(List.of(new PerfumeImageUrl(11L, THUMBNAIL)));

        NaturalLanguageRecommendationResponse response = service.recommend(QUERY);

        assertThat(response.perfumes())
                .extracting(RecommendedPerfumeResponse::thumbnailUrl)
                .containsExactly(THUMBNAIL, null);
    }

    /** 사용자가 쓴 말을 그대로 돌려줍니다. 화면이 "이렇게 찾았습니다" 를 보여줍니다. */
    @Test
    void echoesQueryAsWritten() {
        given(nlrClient.recommend(QUERY)).willReturn(aiResponse("NO_CONDITION"));

        assertThat(service.recommend(QUERY).query()).isEqualTo(QUERY);
    }

    /**
     * 향 조건이 하나도 없어도 <b>이유가 붙습니다.</b>
     *
     * <p>성별·계절만으로 고른 추천은 {@code matched} 가 빕니다. 그대로 두면 이유가 한 줄도
     * 없는 카드가 나가 계약이 정한 "1~3개" 와 요구사항 NLR-07 을 어깁니다. 실제로 후보를 좁힌
     * 것이 성별·계절이므로 그것을 이유로 씁니다.
     */
    @Test
    void buildsReasonsFromMatchedDataWhenNoScentCondition() {
        given(nlrClient.recommend(QUERY)).willReturn(aiResponse(
                "OK_RELAXED",
                List.of(data("gender", "unisex", "중성적인", null),
                        data("season", "summer", "여름에 어울리는", null)),
                result(73368L)));
        given(perfumeRepository.findIdentitiesByFragranticaIds(anyCollection()))
                .willReturn(List.of(identity(73368L, 1L, "Laundry", "브랜드")));

        NaturalLanguageRecommendationResponse response = service.recommend(QUERY);

        // from 이 둘 다 null 이라 표현 없는 이유 한 줄로 묶입니다.
        assertThat(response.perfumes().getFirst().reasons())
                .extracting(RecommendationReasonResponse::phrase,
                        RecommendationReasonResponse::evidence)
                .containsExactly(tuple(null, "중성적인 · 여름에 어울리는"));
    }

    /**
     * 같은 표현을 향 근거가 이미 설명하고 있으면 노트는 안 겹칩니다.
     *
     * <p>{@code 미모사} 는 {@code matched} 도 {@code matchedData} 도 {@code from} 이 같습니다.
     * 그대로 두면 <i>"'미모사' → 플로럴 · 미모사"</i> 처럼 같은 말이 근거로 또 붙습니다.
     */
    @Test
    void doesNotRepeatNoteAlreadyExplainedByAccord() {
        given(nlrClient.recommend(QUERY)).willReturn(aiResponse(
                "OK",
                List.of(data("note", "mimosa", "미모사", "미모사")),
                result(73368L, matched("floral", "미모사"))));
        given(perfumeRepository.findIdentitiesByFragranticaIds(anyCollection()))
                .willReturn(List.of(identity(73368L, 1L, "Petal Poetry", "브랜드")));

        NaturalLanguageRecommendationResponse response = service.recommend(QUERY);

        assertThat(response.perfumes().getFirst().reasons())
                .extracting(RecommendationReasonResponse::phrase,
                        RecommendationReasonResponse::evidence)
                .containsExactly(tuple("미모사", "floral"));
    }

    /**
     * 향 근거가 셋이면 성별·계절은 잘립니다.
     *
     * <p>이유는 1~3개입니다. <b>사용자가 말한 향이 성별·계절 필터보다 앞섭니다</b> — 뒤에
     * 붙이므로 자를 때 이쪽이 먼저 빠집니다.
     */
    @Test
    void dropsMatchedDataWhenScentReasonsAlreadyFillTheLimit() {
        given(nlrClient.recommend(QUERY)).willReturn(aiResponse(
                "OK",
                List.of(data("gender", "unisex", "중성적인", null)),
                result(73368L, matched("soapy", "빨래"), matched("fresh", "세탁"),
                        matched("citrus", "상큼"))));
        given(perfumeRepository.findIdentitiesByFragranticaIds(anyCollection()))
                .willReturn(List.of(identity(73368L, 1L, "Laundry", "브랜드")));

        NaturalLanguageRecommendationResponse response = service.recommend(QUERY);

        assertThat(response.perfumes().getFirst().reasons())
                .extracting(RecommendationReasonResponse::phrase)
                .containsExactly("빨래", "세탁", "상큼");
    }

    /**
     * 둘이 섞여 한도를 넘으면 <b>향 근거가 남고 그다음 자리를 {@code matchedData} 가 채웁니다.</b>
     *
     * <p>{@code dropsMatchedDataWhenScentReasonsAlreadyFillTheLimit} 는 향 근거만으로 셋이
     * 차는 경우고, 여기는 <b>경계</b>입니다 — 향 둘에 향이 아닌 근거 셋이면 다섯 줄이 되고
     * 그중 셋만 나갑니다. 무엇이 먼저 빠지는지는 이 배치에서만 드러납니다.
     */
    @Test
    void keepsScentReasonsFirstWhenBothKindsCompeteForTheLimit() {
        given(nlrClient.recommend(QUERY)).willReturn(aiResponse(
                "OK",
                List.of(data("note", "mimosa", "미모사", "미모사"),
                        data("note", "rose", "장미", "장미"),
                        data("gender", "unisex", "중성적인", null)),
                result(73368L, matched("soapy", "빨래"), matched("fresh", "세탁"))));
        given(perfumeRepository.findIdentitiesByFragranticaIds(anyCollection()))
                .willReturn(List.of(identity(73368L, 1L, "Laundry", "브랜드")));

        NaturalLanguageRecommendationResponse response = service.recommend(QUERY);

        // 향 둘이 남고 남은 한 자리를 첫 노트가 가져갑니다. 장미와 성별은 빠집니다.
        assertThat(response.perfumes().getFirst().reasons())
                .extracting(RecommendationReasonResponse::phrase,
                        RecommendationReasonResponse::evidence)
                .containsExactly(
                        tuple("빨래", "soapy"),
                        tuple("세탁", "fresh"),
                        tuple("미모사", "미모사"));

        // 잘린 것도 최상위에는 그대로 있습니다 — 목록 위 한 줄이 쓸 재료입니다.
        assertThat(response.matchedData())
                .extracting(RecommendationDataResponse::label)
                .containsExactly("미모사", "장미", "중성적인");
    }

    /**
     * 최상위 {@code matchedData} 는 <b>내부 값을 뺀 채</b> 나갑니다.
     *
     * <p>{@code value}({@code unisex})와 {@code tier}({@code DATA})는 내부 기록이라 화면에
     * 내보내지 않습니다. {@code matched[].accord}·{@code tier} 를 안 내보내는 것과 같습니다.
     */
    @Test
    void exposesMatchedDataWithoutInternalFields() {
        given(nlrClient.recommend(QUERY)).willReturn(aiResponse(
                "OK_RELAXED",
                List.of(data("gender", "unisex", "중성적인", null)),
                result(73368L)));
        given(perfumeRepository.findIdentitiesByFragranticaIds(anyCollection()))
                .willReturn(List.of(identity(73368L, 1L, "Laundry", "브랜드")));

        NaturalLanguageRecommendationResponse response = service.recommend(QUERY);

        assertThat(response.matchedData())
                .extracting(RecommendationDataResponse::field,
                        RecommendationDataResponse::label)
                .containsExactly(tuple("gender", "중성적인"));
    }

    /** 조건을 안 걸었으면 {@code null} 이 아니라 빈 배열입니다. */
    @Test
    void returnsEmptyMatchedDataWhenAiSendsNone() {
        given(nlrClient.recommend(QUERY)).willReturn(new NlrRecommendResponse(
                "NO_CONDITION", QUERY, null, null, null, null, List.of(), null, null));

        assertThat(service.recommend(QUERY).matchedData()).isEmpty();
    }

    private static NlrRecommendResponse aiResponse(
            String status, NlrRecommendResponse.Result... results) {
        return aiResponse(status, List.of(), results);
    }

    private static NlrRecommendResponse aiResponse(
            String status,
            List<NlrRecommendResponse.MatchedData> matchedData,
            NlrRecommendResponse.Result... results) {
        return new NlrRecommendResponse(
                status, QUERY, null, null, null, matchedData, List.of(results), null, null);
    }

    private static NlrRecommendResponse.Result result(
            Long fragranticaId, NlrRecommendResponse.Matched... matched) {
        return new NlrRecommendResponse.Result(fragranticaId, List.of(matched));
    }

    private static NlrRecommendResponse.Matched matched(String accord, String from) {
        return new NlrRecommendResponse.Matched(accord, from);
    }

    private static NlrRecommendResponse.MatchedData data(
            String field, String value, String label, String from) {
        return new NlrRecommendResponse.MatchedData(field, value, label, from, "DATA");
    }

    private static PerfumeIdentity identity(
            Long fragranticaId, Long perfumeId, String name, String brandName) {
        return new PerfumeIdentity(fragranticaId, perfumeId, name, null, brandName, null);
    }
}
