package com.hyanghae.backend.recommendation.service;

import com.hyanghae.backend.global.exception.BusinessException;
import com.hyanghae.backend.global.security.CurrentUser;
import com.hyanghae.backend.recommendation.dto.response.PersonalizedPerfumeResponse;
import com.hyanghae.backend.recommendation.dto.response.PersonalizedRecommendationResponse;
import com.hyanghae.backend.recommendation.exception.RecommendationErrorCode;
import com.hyanghae.backend.recommendation.repository.PersonalizedRecommendationCandidate;
import com.hyanghae.backend.recommendation.repository.PersonalizedRecommendationRepository;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 취향·적합도·최근 관심으로 진열대 모달의 향수 한 개를 추천합니다. */
@Service
public class PersonalizedRecommendationService {

    private static final int CANDIDATE_LIMIT = 10;
    private static final int EXPOSURE_COOLDOWN_DAYS = 3;

    private final PersonalizedRecommendationRepository recommendationRepository;
    private final PersonalizedCandidateSelector candidateSelector;
    private final CurrentUser currentUser;

    public PersonalizedRecommendationService(
            PersonalizedRecommendationRepository recommendationRepository,
            PersonalizedCandidateSelector candidateSelector,
            CurrentUser currentUser
    ) {
        this.recommendationRepository = recommendationRepository;
        this.candidateSelector = candidateSelector;
        this.currentUser = currentUser;
    }

    /** 후보 선택과 노출 저장을 한 트랜잭션에서 처리합니다. */
    @Transactional
    public PersonalizedRecommendationResponse recommend() {
        Long userId = currentUser.id()
                .orElseThrow(() -> new BusinessException(
                        RecommendationErrorCode.RECOMMENDATION_LOGIN_REQUIRED));
        if (!recommendationRepository.hasTasteProfile(userId)) {
            throw new BusinessException(
                    RecommendationErrorCode.RECOMMENDATION_TASTE_TEST_REQUIRED);
        }
        recommendationRepository.lockForUser(userId);
        List<PersonalizedRecommendationCandidate> candidates =
                recommendationRepository.findTopCandidates(userId, CANDIDATE_LIMIT);
        if (candidates.isEmpty()) {
            throw new BusinessException(RecommendationErrorCode.RECOMMENDATION_NOT_FOUND);
        }

        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        PersonalizedRecommendationCandidate selected = candidateSelector.select(
                candidates,
                now.minusDays(EXPOSURE_COOLDOWN_DAYS));
        recommendationRepository.saveExposure(userId, selected.perfumeId(), now);

        return new PersonalizedRecommendationResponse(new PersonalizedPerfumeResponse(
                selected.perfumeId(),
                selected.name(),
                selected.imageUrl(),
                reasonOf(selected)));
    }

    private String reasonOf(PersonalizedRecommendationCandidate candidate) {
        return switch (candidate.evidenceSource()) {
            case "FIT" -> "높게 평가한 향수와 " + candidate.evidenceName() + " 어코드가 비슷해요.";
            case "RECENT" -> "최근 살펴본 향수에서 자주 만난 "
                    + candidate.evidenceName() + " 어코드를 담고 있어요.";
            default -> "취향 테스트에서 선택한 " + candidate.evidenceName() + " 계열과 잘 맞아요.";
        };
    }
}
