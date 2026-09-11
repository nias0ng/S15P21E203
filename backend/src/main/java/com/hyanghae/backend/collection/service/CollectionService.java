package com.hyanghae.backend.collection.service;

import com.hyanghae.backend.collection.dto.request.CollectionCreateRequest;
import com.hyanghae.backend.collection.dto.request.CollectionUpdateRequest;
import com.hyanghae.backend.collection.dto.response.CollectionCreateResponse;
import com.hyanghae.backend.collection.dto.response.CollectionDetailResponse;
import com.hyanghae.backend.collection.dto.response.CollectionPerfumeCreateResponse;
import com.hyanghae.backend.collection.dto.response.CollectionPerfumeResponse;
import com.hyanghae.backend.collection.dto.response.CollectionsResponse;
import com.hyanghae.backend.collection.dto.response.CollectionUpdateResponse;
import com.hyanghae.backend.collection.entity.Collection;
import com.hyanghae.backend.collection.entity.CollectionPerfume;
import com.hyanghae.backend.collection.exception.CollectionErrorCode;
import com.hyanghae.backend.collection.repository.CollectionPerfumeRepository;
import com.hyanghae.backend.collection.repository.CollectionRepository;
import com.hyanghae.backend.global.exception.BusinessException;
import com.hyanghae.backend.global.security.CurrentUser;
import com.hyanghae.backend.perfume.repository.PerfumeImageRepository;
import com.hyanghae.backend.perfume.repository.PerfumeImageUrl;
import com.hyanghae.backend.shelf.entity.UserPerfume;
import com.hyanghae.backend.shelf.repository.UserPerfumeRepository;
import java.time.OffsetDateTime;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CollectionService {

    private static final int MAX_PAGE_SIZE = 100;

    private final CollectionRepository collectionRepository;
    private final CollectionPerfumeRepository collectionPerfumeRepository;
    private final UserPerfumeRepository userPerfumeRepository;
    private final PerfumeImageRepository perfumeImageRepository;
    private final CurrentUser currentUser;

    public CollectionService(
            CollectionRepository collectionRepository,
            CollectionPerfumeRepository collectionPerfumeRepository,
            UserPerfumeRepository userPerfumeRepository,
            PerfumeImageRepository perfumeImageRepository,
            CurrentUser currentUser
    ) {
        this.collectionRepository = collectionRepository;
        this.collectionPerfumeRepository = collectionPerfumeRepository;
        this.userPerfumeRepository = userPerfumeRepository;
        this.perfumeImageRepository = perfumeImageRepository;
        this.currentUser = currentUser;
    }

    @Transactional
    public CollectionCreateResponse create(CollectionCreateRequest request) {
        Long userId = currentUserId();
        if (new HashSet<>(request.shelfItemIds()).size() != request.shelfItemIds().size()) {
            throw new BusinessException(CollectionErrorCode.COLLECTION_INVALID_REQUEST);
        }

        List<UserPerfume> foundShelfItems = userPerfumeRepository
                .findAllByIdInAndUserIdForUpdate(request.shelfItemIds(), userId);
        if (foundShelfItems.size() != request.shelfItemIds().size()) {
            throw new BusinessException(CollectionErrorCode.COLLECTION_SHELF_ITEM_NOT_FOUND);
        }

        Map<Long, UserPerfume> shelfItemsById = foundShelfItems.stream()
                .collect(Collectors.toMap(UserPerfume::getId, Function.identity()));
        List<UserPerfume> orderedShelfItems = request.shelfItemIds().stream()
                .map(shelfItemsById::get)
                .toList();
        String name = request.name().strip();
        String description = normalizeDescription(request.description());
        OffsetDateTime now = OffsetDateTime.now();

        Collection collection = Collection.create(
                userId,
                name,
                description,
                orderedShelfItems,
                now
        );
        try {
            collectionRepository.saveAndFlush(collection);
        } catch (DataIntegrityViolationException exception) {
            throw new BusinessException(CollectionErrorCode.COLLECTION_NAME_ALREADY_EXISTS);
        }
        return new CollectionCreateResponse(collection.getId(), name, description, now);
    }

    @Transactional
    public CollectionPerfumeCreateResponse addPerfume(
            Long collectionId,
            Long shelfItemId
    ) {
        Long userId = currentUserId();
        UserPerfume shelfItem = userPerfumeRepository
                .findByIdAndUserIdForUpdate(shelfItemId, userId)
                .orElseThrow(() -> new BusinessException(
                        CollectionErrorCode.COLLECTION_SHELF_ITEM_NOT_FOUND
                ));
        Collection collection = collectionRepository
                .findByIdAndUserIdForUpdate(collectionId, userId)
                .orElseThrow(() -> new BusinessException(
                        CollectionErrorCode.COLLECTION_NOT_FOUND
                ));

        if (collectionPerfumeRepository.existsByCollectionIdAndShelfItemId(
                collectionId,
                shelfItemId
        )) {
            throw new BusinessException(
                    CollectionErrorCode.COLLECTION_PERFUME_ALREADY_EXISTS
            );
        }

        Integer maxDisplayOrder = collectionPerfumeRepository
                .findMaxDisplayOrderByCollectionId(collectionId);
        int displayOrder = maxDisplayOrder == null ? 0 : maxDisplayOrder + 1;
        OffsetDateTime createdAt = OffsetDateTime.now();
        CollectionPerfume collectionPerfume = CollectionPerfume.create(
                collection,
                shelfItem,
                displayOrder,
                createdAt
        );
        collection.updateModifiedAt(createdAt);

        try {
            collectionPerfumeRepository.saveAndFlush(collectionPerfume);
        } catch (DataIntegrityViolationException exception) {
            throw new BusinessException(
                    CollectionErrorCode.COLLECTION_PERFUME_ALREADY_EXISTS
            );
        }

        return new CollectionPerfumeCreateResponse(
                collectionId,
                shelfItemId,
                createdAt
        );
    }

    @Transactional
    public void removePerfume(Long collectionId, Long shelfItemId) {
        Collection collection = findMineForUpdate(collectionId);
        CollectionPerfume collectionPerfume = collectionPerfumeRepository
                .findByCollectionIdAndShelfItemIdForUpdate(collectionId, shelfItemId)
                .orElseThrow(() -> new BusinessException(
                        CollectionErrorCode.COLLECTION_PERFUME_NOT_FOUND
                ));

        if (collectionPerfumeRepository.countByCollectionId(collectionId) <= 1) {
            throw new BusinessException(CollectionErrorCode.COLLECTION_LAST_PERFUME);
        }

        collectionPerfumeRepository.delete(collectionPerfume);
        collection.updateModifiedAt(OffsetDateTime.now());
    }

    @Transactional
    public CollectionUpdateResponse update(Long collectionId, CollectionUpdateRequest request) {
        Collection collection = findMineForUpdate(collectionId);
        String name = request.isNamePresent()
                ? request.getName().strip()
                : collection.getName();
        String description = request.isDescriptionPresent()
                ? normalizeDescription(request.getDescription())
                : collection.getDescription();
        OffsetDateTime now = OffsetDateTime.now();

        collection.update(name, description, now);
        try {
            collectionRepository.flush();
        } catch (DataIntegrityViolationException exception) {
            throw new BusinessException(CollectionErrorCode.COLLECTION_NAME_ALREADY_EXISTS);
        }
        return new CollectionUpdateResponse(collectionId, name, description, now);
    }

    @Transactional
    public void delete(Long collectionId) {
        collectionRepository.delete(findMineForUpdate(collectionId));
    }

    @Transactional(readOnly = true)
    public CollectionsResponse findMine(int page, int size) {
        Long userId = currentUserId();
        int pageNumber = Math.max(page, 0);
        int pageSize = Math.clamp(size, 1, MAX_PAGE_SIZE);
        var found = collectionRepository.findPageByUserId(
                userId,
                PageRequest.of(pageNumber, pageSize)
        );
        return new CollectionsResponse(
                found.getContent(),
                found.getNumber(),
                found.getSize(),
                found.getTotalElements()
        );
    }

    @Transactional(readOnly = true)
    public CollectionDetailResponse findMine(Long collectionId) {
        Collection collection = collectionRepository
                .findByIdAndUserId(collectionId, currentUserId())
                .orElseThrow(() -> new BusinessException(
                        CollectionErrorCode.COLLECTION_NOT_FOUND
                ));
        List<CollectionPerfumeResponse> perfumes = collectionPerfumeRepository
                .findAllByCollectionId(collectionId);
        Map<Long, String> thumbnails = loadThumbnails(perfumes);
        List<CollectionPerfumeResponse> perfumesWithThumbnails = perfumes.stream()
                .map(perfume -> perfume.withThumbnailUrl(thumbnails.get(perfume.perfumeId())))
                .toList();

        return new CollectionDetailResponse(
                collectionId,
                collection.getName(),
                collection.getDescription(),
                perfumesWithThumbnails,
                collection.getCreatedAt(),
                collection.getUpdatedAt()
        );
    }

    private Collection findMineForUpdate(Long collectionId) {
        return collectionRepository
                .findByIdAndUserIdForUpdate(collectionId, currentUserId())
                .orElseThrow(() -> new BusinessException(
                        CollectionErrorCode.COLLECTION_NOT_FOUND
                ));
    }

    private Map<Long, String> loadThumbnails(List<CollectionPerfumeResponse> perfumes) {
        List<Long> perfumeIds = perfumes.stream()
                .map(CollectionPerfumeResponse::perfumeId)
                .toList();
        if (perfumeIds.isEmpty()) {
            return Map.of();
        }
        return perfumeImageRepository.findOrderedByPerfumeIds(perfumeIds)
                .stream()
                .filter(image -> image.imageUrl() != null)
                .collect(Collectors.toMap(
                        PerfumeImageUrl::perfumeId,
                        PerfumeImageUrl::imageUrl,
                        (first, ignored) -> first
                ));
    }

    private Long currentUserId() {
        return currentUser.id()
                .orElseThrow(() -> new BusinessException(
                        CollectionErrorCode.COLLECTION_LOGIN_REQUIRED
                ));
    }

    private String normalizeDescription(String value) {
        return value == null || value.isBlank() ? null : value.strip();
    }
}
