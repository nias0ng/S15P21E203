package com.hyanghae.backend.shelf.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.hyanghae.backend.global.exception.BusinessException;
import com.hyanghae.backend.global.security.CurrentUser;
import com.hyanghae.backend.shelf.dto.response.MemoCreateResponse;
import com.hyanghae.backend.shelf.dto.response.MemoResponse;
import com.hyanghae.backend.shelf.dto.response.MemoUpdateResponse;
import com.hyanghae.backend.shelf.entity.Memo;
import com.hyanghae.backend.shelf.entity.UserPerfume;
import com.hyanghae.backend.shelf.exception.ShelfErrorCode;
import com.hyanghae.backend.shelf.repository.MemoRepository;
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
class MemoServiceTest {

    private static final long USER_ID = 1L;
    private static final long SHELF_ITEM_ID = 185L;
    private static final long MEMO_ID = 1L;

    @Mock
    private MemoRepository memoRepository;

    @Mock
    private UserPerfumeRepository userPerfumeRepository;

    @Mock
    private CurrentUser currentUser;

    private MemoService memoService;

    @BeforeEach
    void setUp() {
        memoService = new MemoService(
                memoRepository,
                userPerfumeRepository,
                currentUser
        );
    }

    @Test
    void createsMemo() {
        UserPerfume shelfItem = BeanUtils.instantiateClass(UserPerfume.class);
        when(currentUser.id()).thenReturn(Optional.of(USER_ID));
        when(userPerfumeRepository.findByIdAndUserIdForUpdate(SHELF_ITEM_ID, USER_ID))
                .thenReturn(Optional.of(shelfItem));
        when(memoRepository.findByUserPerfumeId(SHELF_ITEM_ID))
                .thenReturn(Optional.empty());
        when(memoRepository.saveAndFlush(any(Memo.class)))
                .thenAnswer(invocation -> assignId(invocation.getArgument(0)));

        MemoCreateResponse response = memoService.create(
                SHELF_ITEM_ID,
                "새 메모"
        );

        assertThat(response.memoId()).isEqualTo(MEMO_ID);
        assertThat(response.content()).isEqualTo("새 메모");
    }

    @Test
    void rejectsDuplicateMemo() {
        UserPerfume shelfItem = BeanUtils.instantiateClass(UserPerfume.class);
        when(currentUser.id()).thenReturn(Optional.of(USER_ID));
        when(userPerfumeRepository.findByIdAndUserIdForUpdate(SHELF_ITEM_ID, USER_ID))
                .thenReturn(Optional.of(shelfItem));
        when(memoRepository.findByUserPerfumeId(SHELF_ITEM_ID))
                .thenReturn(Optional.of(memo("기존 기록")));

        assertBusinessError(
                () -> memoService.create(SHELF_ITEM_ID, "새 기록"),
                ShelfErrorCode.SHELF_MEMO_ALREADY_EXISTS
        );
        verify(memoRepository, never()).saveAndFlush(any());
    }

    @Test
    void returnsMemo() {
        Memo memo = memo("조회할 기록");
        when(currentUser.id()).thenReturn(Optional.of(USER_ID));
        when(memoRepository.findByShelfItemIdAndUserId(SHELF_ITEM_ID, USER_ID))
                .thenReturn(Optional.of(memo));

        MemoResponse response = memoService.findMine(SHELF_ITEM_ID);

        assertThat(response.memoId()).isEqualTo(MEMO_ID);
        assertThat(response.content()).isEqualTo("조회할 기록");
    }

    @Test
    void updatesContent() {
        Memo memo = memo("수정 전");
        when(currentUser.id()).thenReturn(Optional.of(USER_ID));
        when(memoRepository.findByShelfItemIdAndUserIdForUpdate(
                SHELF_ITEM_ID,
                USER_ID
        )).thenReturn(Optional.of(memo));

        MemoUpdateResponse response = memoService.update(
                SHELF_ITEM_ID,
                "수정 후"
        );

        assertThat(response.content()).isEqualTo("수정 후");
        assertThat(response.updatedAt()).isAfter(memo.getCreatedAt());
    }

    @Test
    void deletesMemo() {
        Memo memo = memo("삭제할 기록");
        when(currentUser.id()).thenReturn(Optional.of(USER_ID));
        when(memoRepository.findByShelfItemIdAndUserIdForUpdate(
                SHELF_ITEM_ID,
                USER_ID
        )).thenReturn(Optional.of(memo));

        memoService.delete(SHELF_ITEM_ID);

        verify(memoRepository).delete(memo);
    }

    @Test
    void rejectsMissingMemo() {
        when(currentUser.id()).thenReturn(Optional.of(USER_ID));
        when(memoRepository.findByShelfItemIdAndUserId(SHELF_ITEM_ID, USER_ID))
                .thenReturn(Optional.empty());

        assertBusinessError(
                () -> memoService.findMine(SHELF_ITEM_ID),
                ShelfErrorCode.SHELF_MEMO_NOT_FOUND
        );
    }

    @Test
    void requiresLogin() {
        when(currentUser.id()).thenReturn(Optional.empty());

        assertBusinessError(
                () -> memoService.findMine(SHELF_ITEM_ID),
                ShelfErrorCode.SHELF_LOGIN_REQUIRED
        );
        verify(memoRepository, never()).findByShelfItemIdAndUserId(any(), any());
    }

    private Memo memo(String content) {
        OffsetDateTime createdAt = OffsetDateTime.parse("2026-09-01T10:00:00+09:00");
        Memo memo = Memo.create(
                BeanUtils.instantiateClass(UserPerfume.class),
                content,
                createdAt
        );
        return assignId(memo);
    }

    private Memo assignId(Memo memo) {
        ReflectionTestUtils.setField(memo, "id", MEMO_ID);
        return memo;
    }

    private void assertBusinessError(Runnable action, ShelfErrorCode errorCode) {
        assertThatThrownBy(action::run)
                .isInstanceOf(BusinessException.class)
                .satisfies(exception -> assertThat(((BusinessException) exception).errorCode())
                        .isEqualTo(errorCode));
    }
}
