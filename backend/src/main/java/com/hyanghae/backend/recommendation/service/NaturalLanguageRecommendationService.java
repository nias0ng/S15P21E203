package com.hyanghae.backend.recommendation.service;

import com.hyanghae.backend.perfume.repository.PerfumeIdentity;
import com.hyanghae.backend.perfume.repository.PerfumeImageRepository;
import com.hyanghae.backend.perfume.repository.PerfumeImageUrl;
import com.hyanghae.backend.perfume.repository.PerfumeRepository;
import com.hyanghae.backend.recommendation.client.NlrClient;
import com.hyanghae.backend.recommendation.client.NlrRecommendResponse;
import com.hyanghae.backend.recommendation.dto.response.NaturalLanguageRecommendationResponse;
import com.hyanghae.backend.recommendation.dto.response.RecommendationReasonResponse;
import com.hyanghae.backend.recommendation.dto.response.RecommendedPerfumeResponse;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * 자연어 추천을 조립합니다.
 *
 * <p>AI 서버가 향수를 찾고, 여기서는 그 결과를 화면이 쓸 수 있는 모양으로 바꿉니다. 하는 일이
 * 셋입니다.
 *
 * <ol>
 *   <li>{@code fragranticaId} 로 우리 DB 를 조회해 {@code perfumeId}·이름·브랜드를 채웁니다.</li>
 *   <li>{@code matched} 를 사용자가 쓴 표현별로 묶어 추천 이유를 만듭니다.</li>
 *   <li>내부 기록({@code accord}·{@code tier}·{@code diagnostics})을 응답에서 뺍니다.
 *       뺄 것도 없습니다 — {@link NlrRecommendResponse} 가 애초에 받지 않습니다.</li>
 * </ol>
 *
 * <p><b>{@code @Transactional} 이 없습니다.</b> 이 메서드는 AI 서버를 최대 8초 기다립니다.
 * 트랜잭션으로 감싸면 그동안 DB 커넥션 하나가 아무 일도 하지 않은 채 붙잡힙니다. 커넥션 풀이
 * 마르면 추천과 무관한 요청까지 밀립니다. 조회가 둘뿐이고 서로 일관성을 요구하지 않으므로
 * 각자의 트랜잭션으로 충분합니다.
 */
@Service
public class NaturalLanguageRecommendationService {

    private static final Logger log =
            LoggerFactory.getLogger(NaturalLanguageRecommendationService.class);

    /** 추천 이유의 최대 개수입니다. 계약서가 1~3개로 정했습니다. */
    private static final int MAX_REASONS = 3;

    /** 향 특성을 잇는 구분자입니다. 계약서가 정한 표기입니다. */
    private static final String EVIDENCE_DELIMITER = " · ";

    /** 조건은 찾았으나 보여줄 향수가 없을 때의 상태입니다. */
    private static final String NO_RESULT = "NO_RESULT";

    /** 향 조건을 하나도 못 뽑았을 때의 상태입니다. 이때는 향수가 없는 것이 정상입니다. */
    private static final String NO_CONDITION = "NO_CONDITION";

    private final NlrClient nlrClient;
    private final PerfumeRepository perfumeRepository;
    private final PerfumeImageRepository perfumeImageRepository;
    private final AccordLabeler accordLabeler;

    public NaturalLanguageRecommendationService(
            NlrClient nlrClient,
            PerfumeRepository perfumeRepository,
            PerfumeImageRepository perfumeImageRepository,
            AccordLabeler accordLabeler
    ) {
        this.nlrClient = nlrClient;
        this.perfumeRepository = perfumeRepository;
        this.perfumeImageRepository = perfumeImageRepository;
        this.accordLabeler = accordLabeler;
    }

    /**
     * 문장 하나로 향수를 추천합니다.
     *
     * @param query 사용자가 쓴 문장입니다. 1~500자로 이미 검증돼 있어야 합니다.
     */
    public NaturalLanguageRecommendationResponse recommend(String query) {
        NlrRecommendResponse ai = nlrClient.recommend(query);
        List<NlrRecommendResponse.Result> results =
                ai.results() == null ? List.of() : ai.results();

        List<RecommendedPerfumeResponse> perfumes = toPerfumes(results);

        return new NaturalLanguageRecommendationResponse(
                resolveStatus(ai.status(), results.size(), perfumes.size()),
                query,
                perfumes
        );
    }

    /**
     * AI 가 찾은 향수를 우리 DB 의 향수로 바꿉니다. <b>AI 가 정한 순서를 지킵니다.</b>
     *
     * <p>추천은 순위가 곧 의미라 순서가 어긋나면 결과가 달라집니다. {@code IN} 절 조회는 보낸
     * 순서를 지키지 않으므로, 조회 결과를 {@code fragranticaId} 로 맵에 담아 두고 AI 가 준
     * 순서대로 다시 세웁니다.
     *
     * <p>DB 에 없는 향수는 빠집니다. {@code perfumeId} 를 채울 수 없고, 못 채운 채 이름만
     * 내보내면 눌러도 아무 데도 가지 않는 카드가 됩니다.
     */
    private List<RecommendedPerfumeResponse> toPerfumes(List<NlrRecommendResponse.Result> results) {
        List<Long> fragranticaIds = results.stream()
                .map(NlrRecommendResponse.Result::fragranticaId)
                .filter(Objects::nonNull)
                .distinct()
                .toList();

        if (fragranticaIds.isEmpty()) {
            return List.of();
        }

        Map<Long, PerfumeIdentity> identities =
                perfumeRepository.findIdentitiesByFragranticaIds(fragranticaIds).stream()
                        .collect(Collectors.toMap(
                                PerfumeIdentity::fragranticaId,
                                Function.identity(),
                                (first, duplicate) -> first,
                                LinkedHashMap::new));

        Map<Long, String> thumbnails = findThumbnails(identities.values());

        List<RecommendedPerfumeResponse> perfumes = new ArrayList<>();
        for (NlrRecommendResponse.Result result : results) {
            PerfumeIdentity identity = identities.get(result.fragranticaId());
            if (identity == null) {
                continue;
            }
            perfumes.add(new RecommendedPerfumeResponse(
                    identity.perfumeId(),
                    displayName(identity.nameKo(), identity.name()),
                    displayName(identity.brandNameKo(), identity.brandName()),
                    thumbnails.get(identity.perfumeId()),
                    reasonsOf(result)));
        }
        return List.copyOf(perfumes);
    }

    /**
     * 대표 이미지를 찾습니다. 향수당 여러 행이 나오므로 첫 행만 씁니다.
     *
     * <p>조회가 대표 이미지부터 순서대로 돌려주므로 먼저 담긴 값을 남깁니다. 이미지가 없는
     * 향수가 대부분이라 결과가 비는 것이 정상입니다.
     *
     * <p>계약서는 {@code thumbnailUrl} 이 항상 {@code null} 이라고 적어 두었는데, 그 뒤
     * {@code perfume_images} 테이블이 생기고 시드가 들어왔습니다. 있는 값을 굳이 버릴 이유가
     * 없어 채웁니다. 형식은 그대로라({@code string | null}) 화면은 안 바뀝니다.
     */
    private Map<Long, String> findThumbnails(Collection<PerfumeIdentity> identities) {
        List<Long> perfumeIds = identities.stream().map(PerfumeIdentity::perfumeId).toList();
        if (perfumeIds.isEmpty()) {
            return Map.of();
        }
        return perfumeImageRepository.findOrderedByPerfumeIds(perfumeIds).stream()
                .collect(Collectors.toMap(
                        PerfumeImageUrl::perfumeId,
                        PerfumeImageUrl::imageUrl,
                        (first, duplicate) -> first));
    }

    /**
     * 사용자가 쓴 표현별로 향 특성을 묶어 추천 이유를 만듭니다.
     *
     * <pre>
     * matched  [ {from:"빨래", accord:"soapy"}, {from:"빨래", accord:"fresh"} ]
     *    ↓
     * reasons  [ { phrase:"빨래", evidence:"비누 같은 · 산뜻한" } ]
     * </pre>
     *
     * <p>{@code from} 이 {@code null} 인 근거가 있습니다. 입력어와 무관하게 걸린 조건이고,
     * 화면은 그때 표현 없이 이유만 보여줍니다. {@link LinkedHashMap} 이 {@code null} 키를
     * 받으므로 따로 다루지 않습니다.
     *
     * <p>순서는 AI 가 준 {@code matched} 순서입니다. 그쪽이 세기 순이라 사용자가 가장 크게
     * 걸린 이유를 먼저 봅니다. 그래서 잘라 낼 때도 뒤에서 자릅니다.
     */
    private List<RecommendationReasonResponse> reasonsOf(NlrRecommendResponse.Result result) {
        if (result.matched() == null) {
            return List.of();
        }

        Map<String, List<String>> labelsByPhrase = new LinkedHashMap<>();
        for (NlrRecommendResponse.Matched matched : result.matched()) {
            String label = accordLabeler.label(matched.accord());
            if (label == null) {
                continue;
            }
            List<String> labels =
                    labelsByPhrase.computeIfAbsent(matched.from(), phrase -> new ArrayList<>());
            if (!labels.contains(label)) {
                labels.add(label);
            }
        }

        return labelsByPhrase.entrySet().stream()
                .limit(MAX_REASONS)
                .map(entry -> new RecommendationReasonResponse(
                        entry.getKey(), String.join(EVIDENCE_DELIMITER, entry.getValue())))
                .toList();
    }

    /**
     * 화면에 보여줄 이름을 고릅니다. 한국어가 있으면 한국어, 없으면 영어입니다.
     *
     * <p>{@code perfumes.name_ko} 가 아직 대부분 비어 있어 지금은 영어가 나갑니다. 채워지면
     * 이 메서드 덕분에 응답이 저절로 한국어로 바뀝니다.
     */
    private static String displayName(String korean, String english) {
        return korean == null || korean.isBlank() ? english : korean;
    }

    /**
     * 보여줄 향수가 하나도 안 남았으면 {@code NO_RESULT} 로 내립니다.
     *
     * <p>AI 는 자기 데이터 13만 개에서 찾으므로 {@code OK} 를 주지만, 그 향수가 우리 DB 에
     * 없으면 화면에 아무것도 못 띄웁니다. 그대로 {@code OK} 를 내보내면 <b>성공했는데 빈
     * 화면</b> 이 되어 프론트가 분기할 방법이 없습니다. 계약서의 {@code NO_RESULT} 가 바로
     * 이 상태를 가리킵니다 — "조건은 찾았으나 결과가 없음".
     *
     * <p>{@code NO_CONDITION} 은 내리지 않습니다. 향 조건 자체를 못 뽑은 것이라 원인이 다르고,
     * 화면이 할 말도 다릅니다.
     *
     * <p>이 일이 잦으면 적재가 밀렸다는 뜻이라 로그를 남깁니다. <b>사용자가 쓴 문장은 남기지
     * 않습니다</b> — 개수만으로 충분합니다.
     */
    private static String resolveStatus(String aiStatus, int foundByAi, int shownToUser) {
        if (shownToUser > 0 || NO_CONDITION.equals(aiStatus) || NO_RESULT.equals(aiStatus)) {
            return aiStatus;
        }

        log.warn("AI 가 찾은 향수가 DB 에 없어 빈 결과로 내립니다: aiStatus={}, foundByAi={}",
                aiStatus, foundByAi);
        return NO_RESULT;
    }
}
