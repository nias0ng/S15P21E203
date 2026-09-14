package com.hyanghae.backend.shelf.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

import com.hyanghae.backend.global.exception.BusinessException;
import com.hyanghae.backend.global.security.CurrentUser;
import com.hyanghae.backend.shelf.dto.response.OwnershipStatusResponse;
import com.hyanghae.backend.shelf.entity.OwnershipStatus;
import com.hyanghae.backend.shelf.entity.UserPerfume;
import com.hyanghae.backend.shelf.exception.ShelfErrorCode;
import com.hyanghae.backend.shelf.repository.UserPerfumeRepository;
import java.time.OffsetDateTime;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.BeanUtils;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class OwnershipStatusServiceTest {

    private static final long USER_ID = 1L;
    private static final long SHELF_ITEM_ID = 155L;

    @Mock
    private UserPerfumeRepository userPerfumeRepository;

    @Mock
    private CurrentUser currentUser;

    private OwnershipStatusService ownershipStatusService;

    @BeforeEach
    void setUp() {
        ownershipStatusService = new OwnershipStatusService(
                userPerfumeRepository,
                currentUser
        );
    }

    @Test
    void updatesOwnershipStatus() {
        UserPerfume shelfItem = shelfItem(OwnershipStatus.TRIED, false);
        logInAndReturn(shelfItem);

        OwnershipStatusResponse response = ownershipStatusService.update(
                SHELF_ITEM_ID,
                OwnershipStatus.WISH
        );

        assertThat(shelfItem.getOwnershipStatus()).isEqualTo(OwnershipStatus.WISH);
        assertThat(shelfItem.getUpdatedAt()).isAfter(OffsetDateTime.parse("2026-09-10T00:00:00Z"));
        assertThat(response.shelfItemId()).isEqualTo(SHELF_ITEM_ID);
        assertThat(response.ownershipStatus()).isEqualTo(OwnershipStatus.WISH);
        assertThat(response.updatedAt()).isEqualTo(shelfItem.getUpdatedAt());
    }

    @Test
    void clearsRepresentativeWhenChangingAwayFromOwned() {
        UserPerfume shelfItem = shelfItem(OwnershipStatus.OWNED, true);
        logInAndReturn(shelfItem);

        ownershipStatusService.update(SHELF_ITEM_ID, OwnershipStatus.TRIED);

        assertThat(shelfItem.getOwnershipStatus()).isEqualTo(OwnershipStatus.TRIED);
        assertThat(shelfItem.getRepresentative()).isFalse();
    }

    @Test
    void doesNotAssignRepresentativeWhenChangingToOwned() {
        UserPerfume shelfItem = shelfItem(OwnershipStatus.WISH, false);
        logInAndReturn(shelfItem);

        ownershipStatusService.update(SHELF_ITEM_ID, OwnershipStatus.OWNED);

        assertThat(shelfItem.getOwnershipStatus()).isEqualTo(OwnershipStatus.OWNED);
        assertThat(shelfItem.getRepresentative()).isFalse();
    }

    @Test
    void rejectsShelfItemNotOwnedByCurrentUser() {
        when(currentUser.id()).thenReturn(Optional.of(USER_ID));
        when(userPerfumeRepository.findByIdAndUserIdForUpdate(SHELF_ITEM_ID, USER_ID))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> ownershipStatusService.update(
                SHELF_ITEM_ID,
                OwnershipStatus.OWNED
        ))
                .isInstanceOf(BusinessException.class)
                .satisfies(exception -> assertThat(((BusinessException) exception).errorCode())
                        .isEqualTo(ShelfErrorCode.SHELF_ITEM_NOT_FOUND));
    }

    @Test
    void requiresLogin() {
        when(currentUser.id()).thenReturn(Optional.empty());

        assertThatThrownBy(() -> ownershipStatusService.update(
                SHELF_ITEM_ID,
                OwnershipStatus.OWNED
        ))
                .isInstanceOf(BusinessException.class)
                .satisfies(exception -> assertThat(((BusinessException) exception).errorCode())
                        .isEqualTo(ShelfErrorCode.SHELF_LOGIN_REQUIRED));
    }

    private void logInAndReturn(UserPerfume shelfItem) {
        when(currentUser.id()).thenReturn(Optional.of(USER_ID));
        when(userPerfumeRepository.findByIdAndUserIdForUpdate(SHELF_ITEM_ID, USER_ID))
                .thenReturn(Optional.of(shelfItem));
    }

    private UserPerfume shelfItem(
            OwnershipStatus ownershipStatus,
            boolean representative
    ) {
        UserPerfume shelfItem = BeanUtils.instantiateClass(UserPerfume.class);
        ReflectionTestUtils.setField(shelfItem, "id", SHELF_ITEM_ID);
        ReflectionTestUtils.setField(shelfItem, "userId", USER_ID);
        ReflectionTestUtils.setField(shelfItem, "ownershipStatus", ownershipStatus);
        ReflectionTestUtils.setField(shelfItem, "representative", representative);
        ReflectionTestUtils.setField(
                shelfItem,
                "updatedAt",
                OffsetDateTime.parse("2026-09-10T00:00:00Z")
        );
        return shelfItem;
    }
}
