package com.hyanghae.backend.shelf.service;

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
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class RepresentativePerfumeService {

    private final UserPerfumeRepository userPerfumeRepository;
    private final CurrentUser currentUser;

    public RepresentativePerfumeService(
            UserPerfumeRepository userPerfumeRepository,
            CurrentUser currentUser
    ) {
        this.userPerfumeRepository = userPerfumeRepository;
        this.currentUser = currentUser;
    }

    @Transactional
    public RepresentativeResponse update(Long userPerfumeId, boolean representative) {
        Long userId = currentUser.id()
                .orElseThrow(() -> new BusinessException(ShelfErrorCode.SHELF_LOGIN_REQUIRED));

        List<UserPerfume> shelfItems = userPerfumeRepository.findAllByUserIdForUpdate(userId);
        UserPerfume target = findTarget(shelfItems, userPerfumeId);

        if (representative && target.getOwnershipStatus() != OwnershipStatus.OWNED) {
            throw new BusinessException(ShelfErrorCode.SHELF_REPRESENTATIVE_REQUIRES_OWNED);
        }

        OffsetDateTime updatedAt = OffsetDateTime.now();
        if (representative) {
            boolean previousRepresentativeCleared = clearCurrentRepresentative(
                    shelfItems,
                    target,
                    updatedAt
            );
            if (previousRepresentativeCleared) {
                userPerfumeRepository.flush();
            }
        }
        target.updateRepresentative(representative, updatedAt);

        return RepresentativeResponse.from(target);
    }

    private UserPerfume findTarget(List<UserPerfume> shelfItems, Long userPerfumeId) {
        return shelfItems.stream()
                .filter(item -> item.getId().equals(userPerfumeId))
                .findFirst()
                .orElseThrow(() -> new BusinessException(ShelfErrorCode.SHELF_ITEM_NOT_FOUND));
    }

    private boolean clearCurrentRepresentative(
            List<UserPerfume> shelfItems,
            UserPerfume target,
            OffsetDateTime updatedAt
    ) {
        Optional<UserPerfume> currentRepresentative = shelfItems.stream()
                .filter(item -> item != target)
                .filter(item -> Boolean.TRUE.equals(item.getRepresentative()))
                .findFirst();
        currentRepresentative.ifPresent(
                item -> item.updateRepresentative(false, updatedAt)
        );
        return currentRepresentative.isPresent();
    }
}
