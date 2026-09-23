package com.hyanghae.backend.recommendation.service;

import com.hyanghae.backend.global.exception.BusinessException;
import com.hyanghae.backend.global.security.CurrentUser;
import com.hyanghae.backend.recommendation.exception.RecommendationErrorCode;
import com.hyanghae.backend.recommendation.repository.PersonalizedRecommendationRepository;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 실제로 화면에 표시된 개인화 추천만 노출 이력으로 확정합니다. */
@Service
public class PersonalizedRecommendationExposureService {

    private final PersonalizedRecommendationRepository repository;
    private final CurrentUser currentUser;

    public PersonalizedRecommendationExposureService(
            PersonalizedRecommendationRepository repository,
            CurrentUser currentUser
    ) {
        this.repository = repository;
        this.currentUser = currentUser;
    }

    @Transactional
    public void complete(UUID token) {
        Long userId = currentUser.id()
                .orElseThrow(() -> new BusinessException(
                        RecommendationErrorCode.RECOMMENDATION_LOGIN_REQUIRED));
        if (repository.hasCompletedExposure(token, userId)) {
            return;
        }

        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        var offeredPerfumeId = repository.findValidOfferForUpdate(token, userId, now);
        if (offeredPerfumeId.isEmpty()) {
            // 같은 토큰의 두 요청이 겹치면 두 번째 요청은 offer 행 잠금에서 기다린 뒤
            // 첫 요청이 옮겨 둔 exposure를 보게 됩니다.
            if (repository.hasCompletedExposure(token, userId)) {
                return;
            }
            throw new BusinessException(
                    RecommendationErrorCode.RECOMMENDATION_EXPOSURE_NOT_FOUND);
        }
        Long perfumeId = offeredPerfumeId.get();
        repository.saveExposure(token, userId, perfumeId, now);
        repository.deleteOffer(token);
    }
}
