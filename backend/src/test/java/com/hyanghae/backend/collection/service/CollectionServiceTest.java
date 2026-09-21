package com.hyanghae.backend.collection.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.mockito.ArgumentMatchers.any;

import com.hyanghae.backend.collection.dto.request.CollectionCreateRequest;
import com.hyanghae.backend.collection.dto.request.CollectionUpdateRequest;
import com.hyanghae.backend.collection.dto.response.CollectionSummaryResponse;
import com.hyanghae.backend.collection.entity.Collection;
import com.hyanghae.backend.collection.entity.CollectionPerfume;
import com.hyanghae.backend.collection.exception.CollectionErrorCode;
import com.hyanghae.backend.collection.repository.CollectionPerfumeRepository;
import com.hyanghae.backend.collection.repository.CollectionRepository;
import com.hyanghae.backend.global.exception.BusinessException;
import com.hyanghae.backend.global.security.CurrentUser;
import com.hyanghae.backend.perfume.repository.PerfumeImageRepository;
import com.hyanghae.backend.shelf.entity.UserPerfume;
import com.hyanghae.backend.shelf.repository.UserPerfumeRepository;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;

class CollectionServiceTest {
    private final CollectionRepository collectionRepository = mock(CollectionRepository.class);
    private final CollectionPerfumeRepository collectionPerfumeRepository =
            mock(CollectionPerfumeRepository.class);
    private final UserPerfumeRepository userPerfumeRepository = mock(UserPerfumeRepository.class);
    private final PerfumeImageRepository perfumeImageRepository = mock(PerfumeImageRepository.class);
    private final CurrentUser currentUser = () -> Optional.of(1L);
    private final CollectionService service = new CollectionService(
            collectionRepository,
            collectionPerfumeRepository,
            userPerfumeRepository,
            perfumeImageRepository,
            currentUser
    );

    @Test
    void duplicateShelfIdsAreRejected() {
        assertThatThrownBy(() -> service.create(new CollectionCreateRequest("a", null, List.of(1L, 1L))))
                .isInstanceOf(BusinessException.class);
        verifyNoInteractions(
                collectionRepository,
                collectionPerfumeRepository,
                userPerfumeRepository,
                perfumeImageRepository
        );
    }

    @Test
    void missingShelfItemIsRejectedBeforeCreation() {
        when(userPerfumeRepository.findAllByIdInAndUserIdForUpdate(List.of(1L, 2L), 1L))
                .thenReturn(List.of(mock(UserPerfume.class)));
        assertThatThrownBy(() -> service.create(new CollectionCreateRequest("a", null, List.of(1L, 2L))))
                .isInstanceOf(BusinessException.class);
        verify(collectionRepository, never()).saveAndFlush(any(Collection.class));
    }

    @Test
    void descriptionClearDoesNotChangeName() {
        var now = OffsetDateTime.now();
        Collection collection = Collection.create(
                1L,
                "original",
                "description",
                List.of(),
                now
        );
        when(collectionRepository.findByIdAndUserIdForUpdate(1L, 1L))
                .thenReturn(Optional.of(collection));
        var request = new CollectionUpdateRequest();
        request.setDescription(null);
        var response = service.update(1L, request);
        assertThat(response.name()).isEqualTo("original");
        assertThat(response.description()).isNull();
    }

    @Test
    void emptyPagePreservesTotalAndClampsSize() {
        PageRequest pageRequest = PageRequest.of(99, 100);
        when(collectionRepository.findPageByUserId(1L, pageRequest)).thenReturn(
                new PageImpl<CollectionSummaryResponse>(List.of(), pageRequest, 10L)
        );
        var response = service.findMine(99, 1000);
        assertThat(response.collections()).isEmpty();
        assertThat(response.page()).isEqualTo(99);
        assertThat(response.size()).isEqualTo(100);
        assertThat(response.totalElements()).isEqualTo(10);
    }

    @Test
    void missingShelfItemIsRejectedBeforeAddingPerfume() {
        when(userPerfumeRepository.findByIdAndUserIdForUpdate(2L, 1L))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.addPerfume(1L, 2L))
                .isInstanceOf(BusinessException.class);
        verifyNoInteractions(collectionRepository);
    }

    @Test
    void translatesConcurrentDuplicatePerfumeInsert() {
        UserPerfume shelfItem = mock(UserPerfume.class);
        Collection collection = mock(Collection.class);
        when(userPerfumeRepository.findByIdAndUserIdForUpdate(2L, 1L))
                .thenReturn(Optional.of(shelfItem));
        when(collectionRepository.findByIdAndUserIdForUpdate(1L, 1L))
                .thenReturn(Optional.of(collection));
        when(collectionPerfumeRepository.existsByCollectionIdAndShelfItemId(1L, 2L))
                .thenReturn(false);
        when(collectionPerfumeRepository.saveAndFlush(any(CollectionPerfume.class)))
                .thenThrow(new DataIntegrityViolationException("duplicate"));

        assertThatThrownBy(() -> service.addPerfume(1L, 2L))
                .isInstanceOfSatisfying(BusinessException.class, exception ->
                        assertThat(exception.errorCode()).isEqualTo(
                                CollectionErrorCode.COLLECTION_PERFUME_ALREADY_EXISTS
                        ));
    }

    @Test
    void lastCollectionPerfumeCannotBeRemoved() {
        Collection collection = mock(Collection.class);
        CollectionPerfume collectionPerfume = mock(CollectionPerfume.class);
        when(collectionRepository.findByIdAndUserIdForUpdate(1L, 1L))
                .thenReturn(Optional.of(collection));
        when(collectionPerfumeRepository.findByCollectionIdAndShelfItemIdForUpdate(1L, 2L))
                .thenReturn(Optional.of(collectionPerfume));
        when(collectionPerfumeRepository.countByCollectionId(1L)).thenReturn(1L);

        assertThatThrownBy(() -> service.removePerfume(1L, 2L))
                .isInstanceOf(BusinessException.class);
        verify(collectionPerfumeRepository, never()).delete(collectionPerfume);
    }
}
