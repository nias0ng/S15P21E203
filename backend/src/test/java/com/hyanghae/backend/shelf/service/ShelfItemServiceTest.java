package com.hyanghae.backend.shelf.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.hyanghae.backend.global.exception.BusinessException;
import com.hyanghae.backend.global.security.CurrentUser;
import com.hyanghae.backend.perfume.entity.Perfume;
import com.hyanghae.backend.perfume.repository.PerfumeRepository;
import com.hyanghae.backend.shelf.dto.response.ShelfItemCreateResponse;
import com.hyanghae.backend.shelf.entity.OwnershipStatus;
import com.hyanghae.backend.shelf.entity.UserPerfume;
import com.hyanghae.backend.shelf.exception.ShelfErrorCode;
import com.hyanghae.backend.shelf.repository.UserPerfumeRepository;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.BeanUtils;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class ShelfItemServiceTest {

    private static final long USER_ID = 1L;
    private static final long PERFUME_ID = 10L;
    private static final long SHELF_ITEM_ID = 156L;

    @Mock
    private UserPerfumeRepository userPerfumeRepository;

    @Mock
    private PerfumeRepository perfumeRepository;

    @Mock
    private CurrentUser currentUser;

    private ShelfItemService shelfItemService;

    @BeforeEach
    void setUp() {
        shelfItemService = new ShelfItemService(
                userPerfumeRepository,
                perfumeRepository,
                currentUser
        );
    }

    @Test
    void defaultsOwnershipStatusToWish() {
        prepareCreate();
        when(userPerfumeRepository.saveAndFlush(any(UserPerfume.class)))
                .thenAnswer(invocation -> assignId(invocation.getArgument(0)));

        ShelfItemCreateResponse response = shelfItemService.create(PERFUME_ID, null);

        assertThat(response.shelfItemId()).isEqualTo(SHELF_ITEM_ID);
        assertThat(response.perfumeId()).isEqualTo(PERFUME_ID);
        assertThat(response.ownershipStatus()).isEqualTo(OwnershipStatus.WISH);
        assertThat(response.createdAt()).isNotNull();
    }

    @Test
    void keepsRequestedOwnershipStatus() {
        prepareCreate();
        when(userPerfumeRepository.saveAndFlush(any(UserPerfume.class)))
                .thenAnswer(invocation -> assignId(invocation.getArgument(0)));

        ShelfItemCreateResponse response = shelfItemService.create(
                PERFUME_ID,
                OwnershipStatus.TRIED
        );

        assertThat(response.ownershipStatus()).isEqualTo(OwnershipStatus.TRIED);
    }

    @Test
    void rejectsUnknownOrInactivePerfume() {
        when(currentUser.id()).thenReturn(Optional.of(USER_ID));
        when(perfumeRepository.findByIdAndActiveTrue(PERFUME_ID)).thenReturn(Optional.empty());

        assertBusinessError(
                () -> shelfItemService.create(PERFUME_ID, null),
                ShelfErrorCode.SHELF_PERFUME_NOT_FOUND
        );
        verify(userPerfumeRepository, never()).saveAndFlush(any());
    }

    @Test
    void rejectsAlreadySavedPerfume() {
        when(currentUser.id()).thenReturn(Optional.of(USER_ID));
        when(perfumeRepository.findByIdAndActiveTrue(PERFUME_ID))
                .thenReturn(Optional.of(perfume()));
        when(userPerfumeRepository.existsByUserIdAndPerfumeId(USER_ID, PERFUME_ID))
                .thenReturn(true);

        assertBusinessError(
                () -> shelfItemService.create(PERFUME_ID, null),
                ShelfErrorCode.SHELF_ITEM_ALREADY_EXISTS
        );
    }

    @Test
    void translatesConcurrentDuplicateInsert() {
        prepareCreate();
        when(userPerfumeRepository.saveAndFlush(any(UserPerfume.class)))
                .thenThrow(new DataIntegrityViolationException("duplicate"));

        assertBusinessError(
                () -> shelfItemService.create(PERFUME_ID, null),
                ShelfErrorCode.SHELF_ITEM_ALREADY_EXISTS
        );
    }

    @Test
    void deletesCurrentUsersShelfItem() {
        UserPerfume shelfItem = BeanUtils.instantiateClass(UserPerfume.class);
        when(currentUser.id()).thenReturn(Optional.of(USER_ID));
        when(userPerfumeRepository.findByIdAndUserIdForUpdate(SHELF_ITEM_ID, USER_ID))
                .thenReturn(Optional.of(shelfItem));

        shelfItemService.delete(SHELF_ITEM_ID);

        verify(userPerfumeRepository).delete(shelfItem);
    }

    @Test
    void hidesOtherUsersShelfItemOnDelete() {
        when(currentUser.id()).thenReturn(Optional.of(USER_ID));
        when(userPerfumeRepository.findByIdAndUserIdForUpdate(SHELF_ITEM_ID, USER_ID))
                .thenReturn(Optional.empty());

        assertBusinessError(
                () -> shelfItemService.delete(SHELF_ITEM_ID),
                ShelfErrorCode.SHELF_ITEM_NOT_FOUND
        );
    }

    @Test
    void requiresLogin() {
        when(currentUser.id()).thenReturn(Optional.empty());

        assertBusinessError(
                () -> shelfItemService.create(PERFUME_ID, null),
                ShelfErrorCode.SHELF_LOGIN_REQUIRED
        );
    }

    private void prepareCreate() {
        when(currentUser.id()).thenReturn(Optional.of(USER_ID));
        when(perfumeRepository.findByIdAndActiveTrue(PERFUME_ID))
                .thenReturn(Optional.of(perfume()));
        when(userPerfumeRepository.existsByUserIdAndPerfumeId(USER_ID, PERFUME_ID))
                .thenReturn(false);
    }

    private Perfume perfume() {
        return BeanUtils.instantiateClass(Perfume.class);
    }

    private UserPerfume assignId(UserPerfume shelfItem) {
        ReflectionTestUtils.setField(shelfItem, "id", SHELF_ITEM_ID);
        return shelfItem;
    }

    private void assertBusinessError(Runnable action, ShelfErrorCode errorCode) {
        assertThatThrownBy(action::run)
                .isInstanceOf(BusinessException.class)
                .satisfies(exception -> assertThat(((BusinessException) exception).errorCode())
                        .isEqualTo(errorCode));
    }
}
