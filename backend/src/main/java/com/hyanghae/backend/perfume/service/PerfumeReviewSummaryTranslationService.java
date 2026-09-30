package com.hyanghae.backend.perfume.service;

import com.hyanghae.backend.global.i18n.Language;
import com.hyanghae.backend.perfume.dto.response.PerfumeReviewAggregatesResponse;
import com.hyanghae.backend.perfume.dto.response.PerfumeReviewSummaryResponse;
import com.hyanghae.backend.perfume.repository.PerfumeReviewSummaryTranslationRepository;
import com.hyanghae.backend.perfume.repository.ReviewSummaryTranslationRow;
import java.util.Objects;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * AI 후기 요약을 요청 언어로 내려줍니다. 영어 요청이면 한국어 요약의 영어판을 씁니다.
 *
 * <p><b>번역은 처음 열릴 때 만듭니다.</b> 배치로 미리 옮기지 않습니다. 영어 화면이 한 번도 열지
 * 않은 향수까지 옮기면 쓰이지 않을 번역에 비용이 듭니다. 영어 요청이 요약을 부르면 저장본을
 * 찾고, 없거나 낡았으면 그 자리에서 번역해 저장한 뒤 돌려줍니다.
 *
 * <p>낡았는지는 {@code source_updated_at} 으로 봅니다. 번역할 때 쓴 한국어 요약의 갱신 시각을
 * 함께 저장해 두고, 지금 한국어 요약의 {@code updatedAt} 과 다르면 배치가 요약을 다시 만든
 * 것이므로 다시 번역합니다.
 *
 * <p><b>번역이 안 되면 한국어 요약을 그대로 돌려줍니다.</b> 오류로 만들지 않습니다. 접속 키가
 * 없거나, 제한 시간을 넘기거나, 모델이 약속한 형식을 어긴 경우입니다. 요약 구역이 비는 것보다
 * 한국어라도 보이는 것이 낫습니다. 낡은 영어판도 쓰지 않습니다 — 지금 한국어 요약과 뜻이 다를
 * 수 있습니다.
 *
 * <p>트랜잭션을 걸지 않습니다. 번역 호출이 몇 초 걸리는 동안 데이터베이스 연결을 붙잡지 않으려고,
 * 한국어 요약은 {@link PerfumeService} 가 먼저 읽어 끝낸 것을 받고 저장만
 * {@link PerfumeReviewSummaryTranslationWriter} 가 짧은 트랜잭션으로 합니다.
 *
 * <p>응답의 모양은 바뀌지 않습니다. {@code summary} 에 영어가 들어갈 뿐이고,
 * {@code sourceReviewCount} · {@code updatedAt} 은 한국어 요약의 값 그대로입니다.
 */
@Service
public class PerfumeReviewSummaryTranslationService {

    private static final Logger log = LoggerFactory.getLogger(PerfumeReviewSummaryTranslationService.class);

    /** {@code language} 열에 적는 영어의 값입니다. 요청 헤더의 언어 태그와 같은 모양입니다. */
    private static final String ENGLISH = "en";

    private final PerfumeReviewSummaryTranslationRepository translationRepository;
    private final PerfumeReviewSummaryTranslationWriter translationWriter;
    private final SummaryTranslator summaryTranslator;

    public PerfumeReviewSummaryTranslationService(
            PerfumeReviewSummaryTranslationRepository translationRepository,
            PerfumeReviewSummaryTranslationWriter translationWriter,
            SummaryTranslator summaryTranslator
    ) {
        this.translationRepository = translationRepository;
        this.translationWriter = translationWriter;
        this.summaryTranslator = summaryTranslator;
    }

    /** 후기 집계의 요약 조각만 요청 언어로 바꿉니다. 나머지 세 조각은 그대로입니다. */
    public PerfumeReviewAggregatesResponse localize(Long perfumeId, PerfumeReviewAggregatesResponse aggregates) {
        PerfumeReviewSummaryResponse localized = localize(perfumeId, aggregates.reviewSummary());
        if (localized == aggregates.reviewSummary()) {
            return aggregates;
        }
        return new PerfumeReviewAggregatesResponse(
                localized,
                aggregates.reviewKeywords(),
                aggregates.reviewStatistics(),
                aggregates.seasonStatistics()
        );
    }

    /**
     * 한국어 요약을 요청 언어로 바꿉니다. 한국어 요청이거나 요약이 없으면 받은 것을 그대로 돌려줍니다.
     *
     * <p>{@code updatedAt} 이 없는 요약은 번역하지 않습니다. 낡았는지 가릴 기준이 없어, 저장하면
     * 한국어 요약이 바뀌어도 알 수 없고 저장하지 않으면 요청마다 번역하게 됩니다. 배치가 적재한
     * 요약에는 항상 있습니다.
     */
    public PerfumeReviewSummaryResponse localize(Long perfumeId, PerfumeReviewSummaryResponse korean) {
        if (!Language.current().isEnglish()
                || korean.summary() == null
                || korean.summary().isBlank()
                || korean.updatedAt() == null) {
            return korean;
        }

        Optional<ReviewSummaryTranslationRow> saved = translationRepository.findRow(perfumeId, ENGLISH);
        if (saved.isPresent() && Objects.equals(saved.get().sourceUpdatedAt(), korean.updatedAt())) {
            return withSummary(korean, saved.get().summaryText());
        }

        return translate(perfumeId, korean, saved.isPresent());
    }

    private PerfumeReviewSummaryResponse translate(
            Long perfumeId,
            PerfumeReviewSummaryResponse korean,
            boolean stale
    ) {
        if (!summaryTranslator.isEnabled()) {
            return korean;
        }

        long startedAt = System.nanoTime();
        String translated;
        try {
            translated = summaryTranslator.translateToEnglish(korean.summary());
        } catch (RuntimeException exception) {
            log.warn(
                    "Review summary translation failed: perfumeId={}, language={}, exceptionType={},"
                            + " durationMs={}",
                    perfumeId,
                    ENGLISH,
                    exception.getClass().getName(),
                    elapsedMillis(startedAt)
            );
            return korean;
        }

        if (translated == null || translated.isBlank()) {
            log.warn("Review summary translation skipped, empty translation: perfumeId={}, language={}",
                    perfumeId, ENGLISH);
            return korean;
        }

        String trimmed = translated.trim();
        save(perfumeId, trimmed, korean);
        log.info(
                "Review summary translated: perfumeId={}, language={}, stale={}, durationMs={}",
                perfumeId,
                ENGLISH,
                stale,
                elapsedMillis(startedAt)
        );
        return withSummary(korean, trimmed);
    }

    /**
     * 번역을 저장합니다. 저장이 실패해도 번역은 이번 응답에 씁니다.
     *
     * <p>이미 비용을 들여 받은 번역입니다. 저장을 못 했다고 한국어를 주면 이번 요청만 손해이고,
     * 다음 요청이 다시 번역해 저장을 시도합니다.
     */
    private void save(Long perfumeId, String translated, PerfumeReviewSummaryResponse korean) {
        try {
            translationWriter.write(perfumeId, ENGLISH, translated, korean.updatedAt());
        } catch (RuntimeException exception) {
            log.warn(
                    "Review summary translation not saved: perfumeId={}, language={}, exceptionType={}",
                    perfumeId,
                    ENGLISH,
                    exception.getClass().getName()
            );
        }
    }

    private static PerfumeReviewSummaryResponse withSummary(
            PerfumeReviewSummaryResponse korean,
            String summary
    ) {
        return new PerfumeReviewSummaryResponse(summary, korean.sourceReviewCount(), korean.updatedAt());
    }

    private static long elapsedMillis(long startedAt) {
        return (System.nanoTime() - startedAt) / 1_000_000;
    }
}
