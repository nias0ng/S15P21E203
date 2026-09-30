package com.hyanghae.backend.perfume.service;

import com.hyanghae.backend.perfume.repository.PerfumeReviewSummaryTranslationRepository;
import java.time.Instant;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 번역한 후기 요약을 저장합니다.
 *
 * <p>{@link PerfumeReviewSummaryWriter} 와 같은 이유로 떼어 둔 빈입니다. 번역 호출은 몇 초가
 * 걸릴 수 있어 트랜잭션 밖에서 하고, 저장만 짧은 트랜잭션으로 감쌉니다. 같은 클래스 안에서
 * 부르면 {@code @Transactional} 이 걸리지 않습니다.
 */
@Service
public class PerfumeReviewSummaryTranslationWriter {

    private final PerfumeReviewSummaryTranslationRepository translationRepository;

    public PerfumeReviewSummaryTranslationWriter(
            PerfumeReviewSummaryTranslationRepository translationRepository
    ) {
        this.translationRepository = translationRepository;
    }

    /** 번역을 넣거나 바꿉니다. 같은 번역을 두 요청이 동시에 저장해도 한 행에 모입니다. */
    @Transactional
    public void write(Long perfumeId, String language, String summaryText, Instant sourceUpdatedAt) {
        translationRepository.upsert(perfumeId, language, summaryText, sourceUpdatedAt);
    }
}
