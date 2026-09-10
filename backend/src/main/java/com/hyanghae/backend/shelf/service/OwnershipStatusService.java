package com.hyanghae.backend.shelf.service;

import com.hyanghae.backend.global.exception.BusinessException;
import com.hyanghae.backend.global.security.CurrentUser;
import com.hyanghae.backend.shelf.dto.response.OwnershipStatusResponse;
import com.hyanghae.backend.shelf.entity.OwnershipStatus;
import com.hyanghae.backend.shelf.entity.UserPerfume;
import com.hyanghae.backend.shelf.exception.ShelfErrorCode;
import com.hyanghae.backend.shelf.repository.UserPerfumeRepository;
import java.time.OffsetDateTime;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class OwnershipStatusService {

    private final UserPerfumeRepository userPerfumeRepository;
    private final CurrentUser currentUser;

    public OwnershipStatusService(
            UserPerfumeRepository userPerfumeRepository,
            CurrentUser currentUser
    ) {
        this.userPerfumeRepository = userPerfumeRepository;
        this.currentUser = currentUser;
    }

    @Transactional
    public OwnershipStatusResponse update(
            Long shelfItemId,
            OwnershipStatus ownershipStatus
    ) {
        Long userId = currentUser.id()
                .orElseThrow(() -> new BusinessException(ShelfErrorCode.SHELF_LOGIN_REQUIRED));

        UserPerfume shelfItem = userPerfumeRepository
                .findByIdAndUserIdForUpdate(shelfItemId, userId)
                .orElseThrow(() -> new BusinessException(ShelfErrorCode.SHELF_ITEM_NOT_FOUND));

        shelfItem.updateOwnershipStatus(ownershipStatus, OffsetDateTime.now());
        return OwnershipStatusResponse.from(shelfItem);
    }
}
