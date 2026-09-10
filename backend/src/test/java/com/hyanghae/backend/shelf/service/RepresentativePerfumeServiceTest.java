package com.hyanghae.backend.shelf.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

import com.hyanghae.backend.global.exception.BusinessException;
import com.hyanghae.backend.global.security.CurrentUser;
import com.hyanghae.backend.shelf.dto.response.RepresentativeResponse;
import com.hyanghae.backend.shelf.entity.OwnershipStatus;
import com.hyanghae.backend.shelf.entity.UserPerfume;
import com.hyanghae.backend.shelf.exception.ShelfErrorCode;
import com.hyanghae.backend.shelf.repository.UserPerfumeRepository;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.BeanUtils;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class RepresentativePerfumeServiceTest {

    private static final long USER_ID = 1L;

    @Mock
    private UserPerfumeRepository userPerfumeRepository;

    @Mock
    private CurrentUser currentUser;

    private RepresentativePerfumeService representativePerfumeService;

    @BeforeEach
    void setUp() {
        representativePerfumeService = new RepresentativePerfumeService(
                userPerfumeRepository,
                currentUser
        );
    }

    @Test
    void replacesCurrentRepresentative() {
        UserPerfume current = shelfItem(154L, OwnershipStatus.OWNED, true);
        UserPerfume target = shelfItem(155L, OwnershipStatus.OWNED, false);
        logInAndReturn(List.of(current, target));

        RepresentativeResponse response = representativePerfumeService.update(155L, true);

        assertThat(current.getRepresentative()).isFalse();
        assertThat(target.getRepresentative()).isTrue();
        assertThat(current.getUpdatedAt()).isEqualTo(target.getUpdatedAt());
        assertThat(response.userPerfumeId()).isEqualTo(155L);
        assertThat(response.representative()).isTrue();
        assertThat(response.updatedAt()).isEqualTo(target.getUpdatedAt());
    }

    @Test
    void clearsTargetWithoutChangingAnotherItem() {
        UserPerfume target = shelfItem(154L, OwnershipStatus.OWNED, true);
        UserPerfume another = shelfItem(155L, OwnershipStatus.OWNED, false);
        logInAndReturn(List.of(target, another));

        RepresentativeResponse response = representativePerfumeService.update(154L, false);

        assertThat(target.getRepresentative()).isFalse();
        assertThat(another.getRepresentative()).isFalse();
        assertThat(response.representative()).isFalse();
    }

    @Test
    void rejectsNonOwnedPerfumeAsRepresentative() {
        UserPerfume target = shelfItem(154L, OwnershipStatus.TRIED, false);
        logInAndReturn(List.of(target));

        assertThatThrownBy(() -> representativePerfumeService.update(154L, true))
                .isInstanceOf(BusinessException.class)
                .satisfies(exception -> assertThat(((BusinessException) exception).errorCode())
                        .isEqualTo(ShelfErrorCode.SHELF_REPRESENTATIVE_REQUIRES_OWNED));

        assertThat(target.getRepresentative()).isFalse();
    }

    @Test
    void rejectsShelfItemNotOwnedByCurrentUser() {
        logInAndReturn(List.of(shelfItem(154L, OwnershipStatus.OWNED, false)));

        assertThatThrownBy(() -> representativePerfumeService.update(999L, true))
                .isInstanceOf(BusinessException.class)
                .satisfies(exception -> assertThat(((BusinessException) exception).errorCode())
                        .isEqualTo(ShelfErrorCode.SHELF_ITEM_NOT_FOUND));
    }

    @Test
    void requiresLogin() {
        when(currentUser.id()).thenReturn(Optional.empty());

        assertThatThrownBy(() -> representativePerfumeService.update(154L, true))
                .isInstanceOf(BusinessException.class)
                .satisfies(exception -> assertThat(((BusinessException) exception).errorCode())
                        .isEqualTo(ShelfErrorCode.SHELF_LOGIN_REQUIRED));
    }

    private void logInAndReturn(List<UserPerfume> shelfItems) {
        when(currentUser.id()).thenReturn(Optional.of(USER_ID));
        when(userPerfumeRepository.findAllByUserIdForUpdate(USER_ID)).thenReturn(shelfItems);
    }

    private UserPerfume shelfItem(
            Long id,
            OwnershipStatus ownershipStatus,
            boolean representative
    ) {
        UserPerfume userPerfume = BeanUtils.instantiateClass(UserPerfume.class);
        ReflectionTestUtils.setField(userPerfume, "id", id);
        ReflectionTestUtils.setField(userPerfume, "userId", USER_ID);
        ReflectionTestUtils.setField(userPerfume, "ownershipStatus", ownershipStatus);
        ReflectionTestUtils.setField(userPerfume, "representative", representative);
        ReflectionTestUtils.setField(userPerfume, "updatedAt", OffsetDateTime.parse("2026-09-10T00:00:00Z"));
        return userPerfume;
    }
}
