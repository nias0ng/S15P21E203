package com.hyanghae.backend.recommendation.service;

import com.hyanghae.backend.global.exception.BusinessException;
import com.hyanghae.backend.global.i18n.Language;
import com.hyanghae.backend.global.security.CurrentUser;
import com.hyanghae.backend.recommendation.config.PersonalizedRecommendationProperties;
import com.hyanghae.backend.recommendation.dto.response.PersonalizedPerfumeResponse;
import com.hyanghae.backend.recommendation.dto.response.PersonalizedRecommendationResponse;
import com.hyanghae.backend.recommendation.exception.RecommendationErrorCode;
import com.hyanghae.backend.recommendation.repository.PersonalizedRecommendationCandidate;
import com.hyanghae.backend.recommendation.repository.PersonalizedRecommendationRepository;
import com.hyanghae.backend.recommendation.service.PersonalizedRecommendationCacheInspector.CacheSnapshot;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/** 취향·적합도·최근 관심으로 진열대 모달의 향수 한 개를 추천합니다. */
@Service
public class PersonalizedRecommendationService {

    private static final Logger log =
            LoggerFactory.getLogger(PersonalizedRecommendationService.class);
    private static final int EXPOSURE_COOLDOWN_DAYS = 3;

    private final PersonalizedRecommendationRepository repository;
    private final PersonalizedRecommendationCacheInspector cacheInspector;
    private final PersonalizedRecommendationRefresher refresher;
    private final PersonalizedCandidateSelector candidateSelector;
    private final PersonalizedRecommendationProperties properties;
    private final CurrentUser currentUser;

    public PersonalizedRecommendationService(
            PersonalizedRecommendationRepository repository,
            PersonalizedRecommendationCacheInspector cacheInspector,
            PersonalizedRecommendationRefresher refresher,
            PersonalizedCandidateSelector candidateSelector,
            PersonalizedRecommendationProperties properties,
            CurrentUser currentUser
    ) {
        this.repository = repository;
        this.cacheInspector = cacheInspector;
        this.refresher = refresher;
        this.candidateSelector = candidateSelector;
        this.properties = properties;
        this.currentUser = currentUser;
    }

    /** 저장 후보를 우선 사용하고, 갱신 조건을 충족한 경우에만 전체 점수를 다시 계산합니다. */
    public PersonalizedRecommendationResponse recommend() {
        Long userId = currentUser.id()
                .orElseThrow(() -> new BusinessException(
                        RecommendationErrorCode.RECOMMENDATION_LOGIN_REQUIRED));
        if (!repository.hasTasteProfile(userId)) {
            throw new BusinessException(
                    RecommendationErrorCode.RECOMMENDATION_TASTE_TEST_REQUIRED);
        }

        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        CacheSnapshot snapshot = cacheInspector.inspect(userId, now);
        if (snapshot.refreshRequired()) {
            snapshot = refreshOrReuseStale(userId, now);
        }
        if (snapshot.emptyResult() || snapshot.candidates().isEmpty()) {
            throw new BusinessException(RecommendationErrorCode.RECOMMENDATION_NOT_FOUND);
        }

        PersonalizedRecommendationCandidate selected = candidateSelector.select(
                snapshot.candidates(),
                now.minusDays(EXPOSURE_COOLDOWN_DAYS));
        UUID token = UUID.randomUUID();
        repository.saveOffer(
                token,
                userId,
                selected.perfumeId(),
                now,
                now.plus(properties.offerTtl()));

        return new PersonalizedRecommendationResponse(
                token,
                new PersonalizedPerfumeResponse(
                        selected.perfumeId(),
                        selected.name(),
                        selected.imageUrl(),
                        PersonalizedRecommendationReasons.reasonOf(selected, Language.current()),
                        selected.originalName(),
                        selected.nameKo(),
                        PersonalizedRecommendationReasons.sourceOf(selected),
                        PersonalizedRecommendationReasons.keyOf(selected)));
    }

    private CacheSnapshot refreshOrReuseStale(
            Long userId,
            OffsetDateTime now
    ) {
        try {
            return refresher.refresh(userId, now);
        } catch (BusinessException exception) {
            throw exception;
        } catch (RuntimeException exception) {
            List<PersonalizedRecommendationCandidate> safeStaleCandidates;
            try {
                // 계산하는 동안 보유 상태나 실제 노출이 달라졌을 수 있으므로 다시 읽습니다.
                safeStaleCandidates = repository.findCachedCandidates(userId);
            } catch (RuntimeException staleReadFailure) {
                exception.addSuppressed(staleReadFailure);
                safeStaleCandidates = List.of();
            }
            log.error(
                    "Personalized recommendation refresh failed: staleReused={}, "
                            + "exceptionType={}",
                    !safeStaleCandidates.isEmpty(),
                    exception.getClass().getName(),
                    exception);
            if (safeStaleCandidates.isEmpty()) {
                throw new BusinessException(RecommendationErrorCode.RECOMMENDATION_REFRESH_FAILED);
            }
            return new CacheSnapshot(true, false, safeStaleCandidates);
        }
    }
}
