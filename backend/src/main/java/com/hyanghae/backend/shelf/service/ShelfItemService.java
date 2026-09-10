package com.hyanghae.backend.shelf.service;

import com.hyanghae.backend.global.exception.BusinessException;
import com.hyanghae.backend.global.security.CurrentUser;
import com.hyanghae.backend.perfume.entity.Perfume;
import com.hyanghae.backend.perfume.repository.PerfumeImageRepository;
import com.hyanghae.backend.perfume.repository.PerfumeImageUrl;
import com.hyanghae.backend.perfume.repository.PerfumeNoteRepository;
import com.hyanghae.backend.perfume.repository.PerfumeRepository;
import com.hyanghae.backend.shelf.dto.response.ShelfItemCreateResponse;
import com.hyanghae.backend.shelf.dto.response.ShelfItemDetailResponse;
import com.hyanghae.backend.shelf.dto.response.ShelfItemsResponse;
import com.hyanghae.backend.shelf.entity.OwnershipStatus;
import com.hyanghae.backend.shelf.entity.PersonalRecord;
import com.hyanghae.backend.shelf.entity.UserPerfume;
import com.hyanghae.backend.shelf.exception.ShelfErrorCode;
import com.hyanghae.backend.shelf.repository.PersonalRecordRepository;
import com.hyanghae.backend.shelf.repository.UserPerfumeRepository;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ShelfItemService {

    private static final OwnershipStatus DEFAULT_OWNERSHIP_STATUS = OwnershipStatus.WISH;
    private static final int MAX_PAGE_SIZE = 100;

    private final UserPerfumeRepository userPerfumeRepository;
    private final PerfumeRepository perfumeRepository;
    private final PerfumeImageRepository perfumeImageRepository;
    private final PerfumeNoteRepository perfumeNoteRepository;
    private final PersonalRecordRepository personalRecordRepository;
    private final CurrentUser currentUser;

    public ShelfItemService(
            UserPerfumeRepository userPerfumeRepository,
            PerfumeRepository perfumeRepository,
            PerfumeImageRepository perfumeImageRepository,
            PerfumeNoteRepository perfumeNoteRepository,
            PersonalRecordRepository personalRecordRepository,
            CurrentUser currentUser
    ) {
        this.userPerfumeRepository = userPerfumeRepository;
        this.perfumeRepository = perfumeRepository;
        this.perfumeImageRepository = perfumeImageRepository;
        this.perfumeNoteRepository = perfumeNoteRepository;
        this.personalRecordRepository = personalRecordRepository;
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

    @Transactional(readOnly = true)
    public ShelfItemsResponse findMine(OwnershipStatus category, int page, int size) {
        Long userId = currentUserId();
        int pageNumber = Math.max(page, 0);
        int pageSize = Math.clamp(size, 1, MAX_PAGE_SIZE);
        PageRequest pageRequest = PageRequest.of(
                pageNumber,
                pageSize,
                Sort.by(Sort.Direction.ASC, "id")
        );

        var found = userPerfumeRepository.findPageByUserIdAndCategory(
                userId,
                category,
                pageRequest
        );
        if (found.isEmpty()) {
            return ShelfItemsResponse.from(found);
        }

        List<Long> perfumeIds = found.getContent().stream()
                .map(item -> item.perfumeId())
                .toList();
        Map<Long, String> thumbnails = loadThumbnails(perfumeIds);

        return ShelfItemsResponse.from(found.map(
                item -> item.withThumbnailUrl(thumbnails.get(item.perfumeId()))
        ));
    }

    @Transactional(readOnly = true)
    public ShelfItemDetailResponse findMine(Long shelfItemId) {
        Long userId = currentUserId();
        ShelfItemDetailResponse detail = userPerfumeRepository
                .findDetailByIdAndUserId(shelfItemId, userId)
                .orElseThrow(() -> new BusinessException(ShelfErrorCode.SHELF_ITEM_NOT_FOUND));
        PersonalRecord personalRecord = personalRecordRepository
                        .findByUserPerfumeId(shelfItemId)
                .orElse(null);

        return detail.withDetails(
                loadThumbnails(List.of(detail.perfumeId())).get(detail.perfumeId()),
                perfumeNoteRepository.findByPerfumeId(detail.perfumeId()),
                personalRecord == null ? null : personalRecord.getContent(),
                personalRecord == null ? null : memoUpdatedAt(personalRecord)
        );
    }

    private Map<Long, String> loadThumbnails(List<Long> perfumeIds) {
        return perfumeImageRepository.findOrderedByPerfumeIds(perfumeIds)
                .stream()
                .filter(image -> image.imageUrl() != null)
                .collect(Collectors.toMap(
                        PerfumeImageUrl::perfumeId,
                        PerfumeImageUrl::imageUrl,
                        (first, ignored) -> first
                ));
    }

    private OffsetDateTime memoUpdatedAt(PersonalRecord personalRecord) {
        return personalRecord.getUpdatedAt() == null
                ? personalRecord.getCreatedAt()
                : personalRecord.getUpdatedAt();
    }

    private Long currentUserId() {
        return currentUser.id()
                .orElseThrow(() -> new BusinessException(ShelfErrorCode.SHELF_LOGIN_REQUIRED));
    }
}
