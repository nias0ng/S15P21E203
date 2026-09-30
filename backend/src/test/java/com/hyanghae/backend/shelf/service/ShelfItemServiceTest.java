package com.hyanghae.backend.shelf.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.hyanghae.backend.global.exception.BusinessException;
import com.hyanghae.backend.global.security.CurrentUser;
import com.hyanghae.backend.perfume.dto.response.PerfumeNoteResponse;
import com.hyanghae.backend.perfume.entity.Perfume;
import com.hyanghae.backend.perfume.entity.PerfumeImageType;
import com.hyanghae.backend.perfume.repository.PerfumeImageRepository;
import com.hyanghae.backend.perfume.repository.PerfumeImageUrl;
import com.hyanghae.backend.perfume.repository.PerfumeNoteRepository;
import com.hyanghae.backend.perfume.repository.PerfumeRepository;
import com.hyanghae.backend.recommendation.service.PersonalizedRecommendationInvalidator;
import com.hyanghae.backend.shelf.dto.response.ShelfItemCreateResponse;
import com.hyanghae.backend.shelf.dto.response.ShelfItemDetailResponse;
import com.hyanghae.backend.shelf.dto.response.ShelfItemSummaryResponse;
import com.hyanghae.backend.shelf.dto.response.ShelfItemsResponse;
import com.hyanghae.backend.shelf.entity.Memo;
import com.hyanghae.backend.shelf.entity.OwnershipStatus;
import com.hyanghae.backend.shelf.entity.UserPerfume;
import com.hyanghae.backend.shelf.exception.ShelfErrorCode;
import com.hyanghae.backend.shelf.repository.MemoRepository;
import com.hyanghae.backend.shelf.repository.UserPerfumeRepository;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.BeanUtils;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
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
    private PerfumeImageRepository perfumeImageRepository;

    @Mock
    private PerfumeNoteRepository perfumeNoteRepository;

    @Mock
    private MemoRepository memoRepository;

    @Mock
    private CurrentUser currentUser;

    @Mock
    private PersonalizedRecommendationInvalidator recommendationInvalidator;

    private ShelfItemService shelfItemService;

    @BeforeEach
    void setUp() {
        shelfItemService = new ShelfItemService(
                userPerfumeRepository,
                perfumeRepository,
                perfumeImageRepository,
                perfumeNoteRepository,
                memoRepository,
                currentUser,
                recommendationInvalidator
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
    void invalidatesRecommendationWhenDeletingShelfItemWithFitRating() {
        UserPerfume shelfItem = UserPerfume.create(
                USER_ID,
                perfume(),
                OwnershipStatus.OWNED,
                OffsetDateTime.now());
        shelfItem.updateFitRating(new BigDecimal("4.5"), OffsetDateTime.now());
        when(currentUser.id()).thenReturn(Optional.of(USER_ID));
        when(userPerfumeRepository.findByIdAndUserIdForUpdate(SHELF_ITEM_ID, USER_ID))
                .thenReturn(Optional.of(shelfItem));

        shelfItemService.delete(SHELF_ITEM_ID);

        verify(recommendationInvalidator).invalidate(USER_ID);
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

    @Test
    void returnsCurrentUsersShelfItems() {
        ShelfItemSummaryResponse shelfItem = new ShelfItemSummaryResponse(
                SHELF_ITEM_ID,
                PERFUME_ID,
                "Test Scent",
                "테스트 향수",
                "Test Brand",
                OwnershipStatus.OWNED,
                true
        );
        PageRequest pageRequest = PageRequest.of(
                1,
                2,
                Sort.by(Sort.Direction.ASC, "id")
        );
        when(currentUser.id()).thenReturn(Optional.of(USER_ID));
        when(userPerfumeRepository.findPageByUserIdAndCategory(
                USER_ID,
                OwnershipStatus.OWNED,
                pageRequest
        ))
                .thenReturn(new PageImpl<>(List.of(shelfItem), pageRequest, 3));
        when(perfumeImageRepository.findOrderedByPerfumeIdsPreferring(
                List.of(PERFUME_ID), PerfumeImageType.PAPER_TEXTURE))
                .thenReturn(List.of(new PerfumeImageUrl(PERFUME_ID, "thumbnail.jpg")));

        ShelfItemsResponse response = shelfItemService.findMine(OwnershipStatus.OWNED, 1, 2);

        assertThat(response.perfumes()).singleElement().satisfies(item -> {
            assertThat(item.brand()).isEqualTo("Test Brand");
            assertThat(item.thumbnailUrl()).isEqualTo("thumbnail.jpg");
            assertThat(item.category()).isEqualTo(OwnershipStatus.OWNED);
        });
        assertThat(response.page()).isEqualTo(1);
        assertThat(response.size()).isEqualTo(2);
        assertThat(response.totalElements()).isEqualTo(3);
    }

    @Test
    void limitsShelfItemPageRange() {
        PageRequest limitedRequest = PageRequest.of(
                0,
                100,
                Sort.by(Sort.Direction.ASC, "id")
        );
        when(currentUser.id()).thenReturn(Optional.of(USER_ID));
        when(userPerfumeRepository.findPageByUserIdAndCategory(
                USER_ID,
                OwnershipStatus.WISH,
                limitedRequest
        ))
                .thenReturn(new PageImpl<>(List.of(), limitedRequest, 0));

        ShelfItemsResponse response = shelfItemService.findMine(OwnershipStatus.WISH, -1, 101);

        assertThat(response.page()).isZero();
        assertThat(response.size()).isEqualTo(100);
        assertThat(response.perfumes()).isEmpty();
    }

    @Test
    void requiresLoginToListShelfItems() {
        when(currentUser.id()).thenReturn(Optional.empty());

        assertBusinessError(
                () -> shelfItemService.findMine(OwnershipStatus.OWNED, 0, 7),
                ShelfErrorCode.SHELF_LOGIN_REQUIRED
        );
        verify(userPerfumeRepository, never()).findPageByUserIdAndCategory(
                any(),
                any(),
                any()
        );
    }

    @Test
    void returnsShelfItemDetail() {
        ShelfItemDetailResponse baseDetail = new ShelfItemDetailResponse(
                SHELF_ITEM_ID,
                PERFUME_ID,
                "Test Scent",
                "테스트 향수",
                "Test Brand",
                OwnershipStatus.OWNED,
                BigDecimal.valueOf(4.5),
                true
        );
        List<PerfumeNoteResponse> scentNotes = List.of(
                new PerfumeNoteResponse(1L, "Orange", "오렌지", "TOP"),
                new PerfumeNoteResponse(2L, "Rose", "로즈", "MIDDLE"),
                new PerfumeNoteResponse(3L, "Patchouli", "패츌리", "BASE")
        );
        OffsetDateTime memoCreatedAt = OffsetDateTime.parse("2026-09-10T00:00:00Z");
        Memo memo = BeanUtils.instantiateClass(Memo.class);
        ReflectionTestUtils.setField(memo, "content", "Test memo");
        ReflectionTestUtils.setField(memo, "createdAt", memoCreatedAt);

        when(currentUser.id()).thenReturn(Optional.of(USER_ID));
        when(userPerfumeRepository.findDetailByIdAndUserId(SHELF_ITEM_ID, USER_ID))
                .thenReturn(Optional.of(baseDetail));
        when(perfumeImageRepository.findOrderedByPerfumeIdsPreferring(
                List.of(PERFUME_ID), PerfumeImageType.PAPER_TEXTURE))
                .thenReturn(List.of(new PerfumeImageUrl(PERFUME_ID, "thumbnail.jpg")));
        when(perfumeNoteRepository.findByPerfumeId(PERFUME_ID)).thenReturn(scentNotes);
        when(memoRepository.findByUserPerfumeId(SHELF_ITEM_ID))
                .thenReturn(Optional.of(memo));

        ShelfItemDetailResponse response = shelfItemService.findMine(SHELF_ITEM_ID);

        assertThat(response.thumbnailUrl()).isEqualTo("thumbnail.jpg");
        assertThat(response.nameKo()).isEqualTo("테스트 향수");
        assertThat(response.rating()).isEqualByComparingTo("4.5");
        assertThat(response.scentNotes()).containsExactlyElementsOf(scentNotes);
        assertThat(response.memo()).isEqualTo("Test memo");
        assertThat(response.memoUpdatedAt()).isEqualTo(memoCreatedAt);
    }

    @Test
    void rejectsShelfItemDetailNotOwnedByCurrentUser() {
        when(currentUser.id()).thenReturn(Optional.of(USER_ID));
        when(userPerfumeRepository.findDetailByIdAndUserId(SHELF_ITEM_ID, USER_ID))
                .thenReturn(Optional.empty());

        assertBusinessError(
                () -> shelfItemService.findMine(SHELF_ITEM_ID),
                ShelfErrorCode.SHELF_ITEM_NOT_FOUND
        );
        verify(perfumeNoteRepository, never()).findByPerfumeId(any());
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
