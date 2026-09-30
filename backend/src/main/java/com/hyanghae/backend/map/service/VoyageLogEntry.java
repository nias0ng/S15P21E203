package com.hyanghae.backend.map.service;

import com.hyanghae.backend.map.dto.response.VisitedPerfumeResponse;
import com.hyanghae.backend.map.dto.response.VoyageLogEntryResponse;
import com.hyanghae.backend.map.repository.ExplorationLogRow;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 만들어지는 중인 향해 일지 한 줄입니다. 기록을 묶는 동안만 씁니다.
 *
 * <p>같은 향수를 여러 번 눌러도 한 번만 담습니다. 한 번의 구역 진입 안에서 같은 향수가 여러 번
 * 나오면 일지가 같은 이름으로 덮이는데, 사용자가 알고 싶은 것은 그 구역에서 무엇을 봤는지입니다.
 * 순서는 처음 들른 순서를 지킵니다.
 */
final class VoyageLogEntry {

    private final ExplorationLogRow opened;
    private final ScentRegionRef region;
    private final Map<Long, VisitedPerfumeResponse> visited = new LinkedHashMap<>();

    VoyageLogEntry(ExplorationLogRow opened, ScentRegionRef region) {
        this.opened = opened;
        this.region = region;
    }

    void visit(ExplorationLogRow row) {
        visited.putIfAbsent(
                row.perfumeId(),
                new VisitedPerfumeResponse(row.perfumeId(), row.perfumeName(), row.perfumeNameKo()));
    }

    /** 계열 영역 밖의 바다는 일지에 그릴 구역이 없습니다. */
    boolean isInsideRegion() {
        return region != null;
    }

    VoyageLogEntryResponse toResponse() {
        List<VisitedPerfumeResponse> perfumes = List.copyOf(visited.values());

        return new VoyageLogEntryResponse(
                opened.logId(),
                opened.visitedAt(),
                region.scentRegionId(),
                region.code(),
                perfumes
        );
    }
}
