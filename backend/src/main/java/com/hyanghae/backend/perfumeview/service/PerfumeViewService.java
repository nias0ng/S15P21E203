package com.hyanghae.backend.perfumeview.service;

import com.hyanghae.backend.global.exception.BusinessException;
import com.hyanghae.backend.global.security.CurrentUser;
import com.hyanghae.backend.perfume.entity.Perfume;
import com.hyanghae.backend.perfume.exception.PerfumeErrorCode;
import com.hyanghae.backend.perfume.repository.PerfumeRepository;
import com.hyanghae.backend.perfumeview.dto.request.PerfumeViewStartRequest;
import com.hyanghae.backend.perfumeview.dto.response.PerfumeViewExitResponse;
import com.hyanghae.backend.perfumeview.dto.response.PerfumeViewStartResponse;
import com.hyanghae.backend.perfumeview.entity.PerfumeView;
import com.hyanghae.backend.perfumeview.entity.PerfumeViewSourceType;
import com.hyanghae.backend.perfumeview.exception.PerfumeViewErrorCode;
import com.hyanghae.backend.perfumeview.repository.PerfumeViewRepository;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PerfumeViewService {

    private final PerfumeViewRepository perfumeViewRepository;
    private final PerfumeRepository perfumeRepository;
    private final CurrentUser currentUser;

    public PerfumeViewService(
            PerfumeViewRepository perfumeViewRepository,
            PerfumeRepository perfumeRepository,
            CurrentUser currentUser
    ) {
        this.perfumeViewRepository = perfumeViewRepository;
        this.perfumeRepository = perfumeRepository;
        this.currentUser = currentUser;
    }

    @Transactional
    public PerfumeViewStartResponse start(PerfumeViewStartRequest request) {
        Long userId = currentUserId();
        validateSource(request);
        Perfume perfume = perfumeRepository.findByIdAndActiveTrue(request.perfumeId())
                .orElseThrow(() -> new BusinessException(PerfumeErrorCode.PERFUME_NOT_FOUND));
        Perfume fromPerfume = findFromPerfume(request.fromPerfumeId());
        Instant viewedAt = now();
        PerfumeView perfumeView = perfumeViewRepository.save(PerfumeView.create(
                userId,
                perfume,
                request.fromLocationType(),
                fromPerfume,
                viewedAt
        ));

        return new PerfumeViewStartResponse(perfumeView.getId(), viewedAt);
    }

    @Transactional
    public PerfumeViewExitResponse exit(Long perfumeViewId) {
        PerfumeView perfumeView = perfumeViewRepository
                .findByIdAndUserIdForUpdate(perfumeViewId, currentUserId())
                .orElseThrow(() -> new BusinessException(
                        PerfumeViewErrorCode.PERFUME_VIEW_NOT_FOUND
                ));
        perfumeView.exit(now());
        return new PerfumeViewExitResponse(
                perfumeView.getId(),
                perfumeView.getExitedAt(),
                perfumeView.getDurationSeconds()
        );
    }

    private Perfume findFromPerfume(Long fromPerfumeId) {
        if (fromPerfumeId == null) {
            return null;
        }
        return perfumeRepository.findByIdAndActiveTrue(fromPerfumeId)
                .orElseThrow(() -> new BusinessException(
                        PerfumeViewErrorCode.PERFUME_VIEW_SOURCE_NOT_FOUND
                ));
    }

    private void validateSource(PerfumeViewStartRequest request) {
        boolean relatedPerfume = request.fromLocationType()
                == PerfumeViewSourceType.RELATED_PERFUME;
        if (relatedPerfume != (request.fromPerfumeId() != null)) {
            throw new BusinessException(PerfumeViewErrorCode.PERFUME_VIEW_INVALID_SOURCE);
        }
    }

    private Long currentUserId() {
        return currentUser.id()
                .orElseThrow(() -> new BusinessException(
                        PerfumeViewErrorCode.PERFUME_VIEW_LOGIN_REQUIRED
                ));
    }

    private Instant now() {
        return Instant.now().truncatedTo(ChronoUnit.MICROS);
    }
}
