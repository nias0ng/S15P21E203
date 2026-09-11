package com.hyanghae.backend.shelf.service;

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
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class MemoService {

    private final MemoRepository memoRepository;
    private final UserPerfumeRepository userPerfumeRepository;
    private final CurrentUser currentUser;

    public MemoService(
            MemoRepository memoRepository,
            UserPerfumeRepository userPerfumeRepository,
            CurrentUser currentUser
    ) {
        this.memoRepository = memoRepository;
        this.userPerfumeRepository = userPerfumeRepository;
        this.currentUser = currentUser;
    }

    @Transactional
    public MemoCreateResponse create(Long shelfItemId, String content) {
        Long userId = currentUserId();
        UserPerfume shelfItem = userPerfumeRepository
                .findByIdAndUserIdForUpdate(shelfItemId, userId)
                .orElseThrow(() -> new BusinessException(ShelfErrorCode.SHELF_ITEM_NOT_FOUND));

        if (memoRepository.findByUserPerfumeId(shelfItemId).isPresent()) {
            throw new BusinessException(ShelfErrorCode.SHELF_MEMO_ALREADY_EXISTS);
        }

        OffsetDateTime createdAt = OffsetDateTime.now();
        Memo memo = Memo.create(
                shelfItem,
                content,
                createdAt.toLocalDate(),
                createdAt
        );

        try {
            return MemoCreateResponse.from(
                    memoRepository.saveAndFlush(memo)
            );
        } catch (DataIntegrityViolationException exception) {
            throw new BusinessException(ShelfErrorCode.SHELF_MEMO_ALREADY_EXISTS);
        }
    }

    @Transactional(readOnly = true)
    public MemoResponse findMine(Long shelfItemId) {
        Memo memo = memoRepository
                .findByShelfItemIdAndUserId(shelfItemId, currentUserId())
                .orElseThrow(() -> new BusinessException(
                        ShelfErrorCode.SHELF_MEMO_NOT_FOUND
                ));
        return MemoResponse.from(memo);
    }

    @Transactional
    public MemoUpdateResponse update(Long shelfItemId, String content) {
        Memo memo = findMineForUpdate(shelfItemId);
        memo.updateContent(content, OffsetDateTime.now());
        return MemoUpdateResponse.from(memo);
    }

    @Transactional
    public void delete(Long shelfItemId) {
        memoRepository.delete(findMineForUpdate(shelfItemId));
    }

    private Memo findMineForUpdate(Long shelfItemId) {
        return memoRepository
                .findByShelfItemIdAndUserIdForUpdate(shelfItemId, currentUserId())
                .orElseThrow(() -> new BusinessException(
                        ShelfErrorCode.SHELF_MEMO_NOT_FOUND
                ));
    }

    private Long currentUserId() {
        return currentUser.id()
                .orElseThrow(() -> new BusinessException(ShelfErrorCode.SHELF_LOGIN_REQUIRED));
    }
}
