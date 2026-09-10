package com.hyanghae.backend.shelf.service;

import com.hyanghae.backend.global.exception.BusinessException;
import com.hyanghae.backend.global.security.CurrentUser;
import com.hyanghae.backend.shelf.dto.response.FitRatingResponse;
import com.hyanghae.backend.shelf.entity.UserPerfume;
import com.hyanghae.backend.shelf.exception.ShelfErrorCode;
import com.hyanghae.backend.shelf.repository.UserPerfumeRepository;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class FitRatingService {

    private static final BigDecimal HALF_POINT = new BigDecimal("0.5");

    private final UserPerfumeRepository userPerfumeRepository;
    private final CurrentUser currentUser;

    public FitRatingService(UserPerfumeRepository userPerfumeRepository, CurrentUser currentUser) {
        this.userPerfumeRepository = userPerfumeRepository;
        this.currentUser = currentUser;
    }

    @Transactional
    public FitRatingResponse update(Long userPerfumeId, BigDecimal fitRating) {
        validateStep(fitRating);

        UserPerfume userPerfume = findOwnedShelfItem(userPerfumeId);
        userPerfume.updateFitRating(fitRating, OffsetDateTime.now());

        return FitRatingResponse.from(userPerfume);
    }

    @Transactional
    public void delete(Long userPerfumeId) {
        UserPerfume userPerfume = findOwnedShelfItem(userPerfumeId);
        userPerfume.clearFitRating(OffsetDateTime.now());
    }

    private UserPerfume findOwnedShelfItem(Long userPerfumeId) {
        Long userId = currentUser.id()
                .orElseThrow(() -> new BusinessException(ShelfErrorCode.SHELF_LOGIN_REQUIRED));

        return userPerfumeRepository.findByIdAndUserIdForUpdate(userPerfumeId, userId)
                .orElseThrow(() -> new BusinessException(ShelfErrorCode.SHELF_ITEM_NOT_FOUND));
    }

    private void validateStep(BigDecimal fitRating) {
        if (fitRating.remainder(HALF_POINT).compareTo(BigDecimal.ZERO) != 0) {
            throw new BusinessException(ShelfErrorCode.SHELF_INVALID_FIT_RATING);
        }
    }
}
