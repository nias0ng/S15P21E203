package com.hyanghae.backend.shelf.service;

import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.hyanghae.backend.global.security.CurrentUser;
import com.hyanghae.backend.perfume.entity.Perfume;
import com.hyanghae.backend.recommendation.service.PersonalizedRecommendationInvalidator;
import com.hyanghae.backend.shelf.entity.OwnershipStatus;
import com.hyanghae.backend.shelf.entity.UserPerfume;
import com.hyanghae.backend.shelf.repository.UserPerfumeRepository;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.BeanUtils;

@ExtendWith(MockitoExtension.class)
class FitRatingServiceTest {

    private static final long USER_ID = 1L;
    private static final long SHELF_ITEM_ID = 2L;

    @Mock
    private UserPerfumeRepository repository;

    @Mock
    private CurrentUser currentUser;

    @Mock
    private PersonalizedRecommendationInvalidator invalidator;

    private FitRatingService service;

    @BeforeEach
    void setUp() {
        service = new FitRatingService(repository, currentUser, invalidator);
        when(currentUser.id()).thenReturn(Optional.of(USER_ID));
    }

    @Test
    void invalidatesOnlyWhenRatingActuallyChanges() {
        UserPerfume shelfItem = shelfItem();
        when(repository.findByIdAndUserIdForUpdate(SHELF_ITEM_ID, USER_ID))
                .thenReturn(Optional.of(shelfItem));

        service.update(SHELF_ITEM_ID, new BigDecimal("4.5"));
        service.update(SHELF_ITEM_ID, new BigDecimal("4.50"));

        verify(invalidator, times(1)).invalidate(USER_ID);
    }

    @Test
    void doesNotInvalidateWhenDeletingAnAlreadyEmptyRating() {
        UserPerfume shelfItem = shelfItem();
        when(repository.findByIdAndUserIdForUpdate(SHELF_ITEM_ID, USER_ID))
                .thenReturn(Optional.of(shelfItem));

        service.delete(SHELF_ITEM_ID);

        verify(invalidator, never()).invalidate(USER_ID);
    }

    @Test
    void invalidatesWhenDeletingAnExistingRating() {
        UserPerfume shelfItem = shelfItem();
        shelfItem.updateFitRating(new BigDecimal("5.0"), OffsetDateTime.now());
        when(repository.findByIdAndUserIdForUpdate(SHELF_ITEM_ID, USER_ID))
                .thenReturn(Optional.of(shelfItem));

        service.delete(SHELF_ITEM_ID);

        verify(invalidator).invalidate(USER_ID);
    }

    private UserPerfume shelfItem() {
        return UserPerfume.create(
                USER_ID,
                BeanUtils.instantiateClass(Perfume.class),
                OwnershipStatus.OWNED,
                OffsetDateTime.now());
    }
}
