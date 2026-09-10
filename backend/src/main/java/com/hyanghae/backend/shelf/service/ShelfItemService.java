package com.hyanghae.backend.shelf.service;

import com.hyanghae.backend.global.exception.BusinessException;
import com.hyanghae.backend.global.security.CurrentUser;
import com.hyanghae.backend.perfume.entity.Perfume;
import com.hyanghae.backend.perfume.repository.PerfumeRepository;
import com.hyanghae.backend.shelf.dto.response.ShelfItemCreateResponse;
import com.hyanghae.backend.shelf.dto.response.ShelfItemsResponse;
import com.hyanghae.backend.shelf.entity.OwnershipStatus;
import com.hyanghae.backend.shelf.entity.UserPerfume;
import com.hyanghae.backend.shelf.exception.ShelfErrorCode;
import com.hyanghae.backend.shelf.repository.UserPerfumeRepository;
import java.time.OffsetDateTime;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ShelfItemService {

    private static final OwnershipStatus DEFAULT_OWNERSHIP_STATUS = OwnershipStatus.WISH;
    private static final int MAX_PAGE_SIZE = 100;

    private final UserPerfumeRepository userPerfumeRepository;
    private final PerfumeRepository perfumeRepository;
    private final CurrentUser currentUser;

    public ShelfItemService(
            UserPerfumeRepository userPerfumeRepository,
            PerfumeRepository perfumeRepository,
            CurrentUser currentUser
    ) {
        this.userPerfumeRepository = userPerfumeRepository;
        this.perfumeRepository = perfumeRepository;
        this.currentUser = currentUser;
    }

    @Transactional
    public ShelfItemCreateResponse create(Long perfumeId, OwnershipStatus ownershipStatus) {
        Long userId = currentUserId();
        Perfume perfume = perfumeRepository.findByIdAndActiveTrue(perfumeId)
                .orElseThrow(() -> new BusinessException(ShelfErrorCode.SHELF_PERFUME_NOT_FOUND));

        if (userPerfumeRepository.existsByUserIdAndPerfumeId(userId, perfumeId)) {
            throw new BusinessException(ShelfErrorCode.SHELF_ITEM_ALREADY_EXISTS);
        }

        OwnershipStatus resolvedStatus = ownershipStatus == null
                ? DEFAULT_OWNERSHIP_STATUS
                : ownershipStatus;
        UserPerfume shelfItem = UserPerfume.create(
                userId,
                perfume,
                resolvedStatus,
                OffsetDateTime.now()
        );

        try {
            UserPerfume savedShelfItem = userPerfumeRepository.saveAndFlush(shelfItem);
            return ShelfItemCreateResponse.from(savedShelfItem, perfumeId);
        } catch (DataIntegrityViolationException exception) {
            throw new BusinessException(ShelfErrorCode.SHELF_ITEM_ALREADY_EXISTS);
        }
    }

    @Transactional
    public void delete(Long shelfItemId) {
        Long userId = currentUserId();
        UserPerfume shelfItem = userPerfumeRepository
                .findByIdAndUserIdForUpdate(shelfItemId, userId)
                .orElseThrow(() -> new BusinessException(ShelfErrorCode.SHELF_ITEM_NOT_FOUND));

        userPerfumeRepository.delete(shelfItem);
    }

    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public ShelfItemsResponse findMine(int page, int size) {
        Long userId = currentUserId();
        int pageNumber = Math.max(page, 0);
        int pageSize = Math.clamp(size, 1, MAX_PAGE_SIZE);
        PageRequest pageRequest = PageRequest.of(
                pageNumber,
                pageSize,
                Sort.by(Sort.Direction.ASC, "id")
        );

        return ShelfItemsResponse.from(
                userPerfumeRepository.findPageByUserId(userId, pageRequest)
        );
    }

    private Long currentUserId() {
        return currentUser.id()
                .orElseThrow(() -> new BusinessException(ShelfErrorCode.SHELF_LOGIN_REQUIRED));
    }
}
