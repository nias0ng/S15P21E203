package com.hyanghae.backend.map.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hyanghae.backend.global.exception.BusinessException;
import com.hyanghae.backend.map.dto.response.MapPerfumeDetailResponse;
import com.hyanghae.backend.map.dto.response.ScentMapResponse;
import com.hyanghae.backend.map.dto.response.ScentRegionResponse;
import com.hyanghae.backend.map.dto.response.ScentVectorResponse;
import com.hyanghae.backend.map.dto.response.ScentVectorsResponse;
import com.hyanghae.backend.map.exception.MapErrorCode;
import com.hyanghae.backend.map.repository.ScentMapRepository;
import com.hyanghae.backend.map.repository.ScentRegionRow;
import com.hyanghae.backend.map.repository.ScentVectorRow;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 향 지도 조회입니다.
 *
 * <p>로그인이 필요하지 않습니다. 요구사항 정의서 MAP-16 이 "비회원도 향 지도를 이용하여 향수를
 * 탐색할 수 있다"로 정하고 있습니다. 탐색 기록·현재 위치·상호작용처럼 사용자에게 매달리는 값은
 * 이 서비스가 다루지 않습니다.
 */
@Service
public class ScentMapService {

    private final ScentMapRepository scentMapRepository;
    private final ScentRegionLocator scentRegionLocator;
    private final ObjectMapper objectMapper;

    public ScentMapService(
            ScentMapRepository scentMapRepository,
            ScentRegionLocator scentRegionLocator,
            ObjectMapper objectMapper) {
        this.scentMapRepository = scentMapRepository;
        this.scentRegionLocator = scentRegionLocator;
        this.objectMapper = objectMapper;
    }

    /**
     * 계열 영역과 향수 좌표를 함께 돌려줍니다.
     *
     * <p>지도에 있는 향수 전체를 한 번에 줍니다. 화면은 이 목록을 받아 두고 배와 가까운 향수를
     * 직접 고릅니다. 배가 움직일 때마다 서버에 물으면 그만큼 왕복이 생깁니다. 지도에 올리는
     * 향수가 200개로 고정이라 가능한 방식입니다.
     */
    @Transactional(readOnly = true)
    public ScentMapResponse getMap() {
        List<ScentRegionResponse> regions = scentMapRepository.findActiveRegions().stream()
                .map(this::toRegion)
                .toList();

        return new ScentMapResponse(regions, scentMapRepository.findPerfumes());
    }

    /**
     * 취향 테스트가 향수를 고를 때 쓰는 계열 벡터입니다.
     *
     * <p>저장소가 향수 하나에 계열 수만큼 줄을 돌려주므로 여기서 향수별로 묶습니다. 한 질의로
     * 읽고 자바에서 묶는 이유는, 향수마다 계열을 따로 조회하면 200번이 나가기 때문입니다.
     *
     * <p>{@link LinkedHashMap} 을 쓰는 이유는 계열 순서를 질의가 정한 대로 두기 위해서입니다.
     * 매칭 결과는 순서와 무관하지만, 응답이 매번 같은 모양이어야 화면이 캐시한 값과 어긋나지
     * 않습니다.
     */
    @Transactional(readOnly = true)
    public ScentVectorsResponse getScentVectors() {
        Map<Long, ScentVectorResponse> byPerfume = new LinkedHashMap<>();
        ScentRegions regions = scentRegionLocator.load();

        for (ScentVectorRow row : scentMapRepository.findScentVectorRows()) {
            byPerfume.computeIfAbsent(row.perfumeId(), id -> new ScentVectorResponse(
                            id,
                            row.x(),
                            row.y(),
                            labelRegionCodeAt(regions, row.x(), row.y()),
                            row.rank(),
                            new LinkedHashMap<>()))
                    .families()
                    .put(row.familyCode(), row.weight());
        }

        return new ScentVectorsResponse(List.copyOf(byPerfume.values()));
    }

    /**
     * 향수가 그려진 자리의 계열입니다. 화면이 폴리곤을 따로 판정하지 않게 서버가 실어 보냅니다
     * — 저장할 때 서버가 같은 판정으로 확인하므로, 두 판정이 갈리면 화면이 고른 향수가 거절됩니다.
     */
    private String labelRegionCodeAt(ScentRegions regions, double x, double y) {
        return regions.labelRegionAt(x, y).map(ScentRegionRef::code).orElse(null);
    }

    /**
     * 지도에서 선택한 향수의 요약입니다.
     *
     * <p>향수가 없을 때, 비활성일 때, 좌표가 없을 때를 모두 같은 404 로 답합니다. 세 경우 모두
     * "지도에 없는 향수"이고 화면이 할 일도 같습니다. 구분해 주면 어떤 향수가 존재하는지가
     * 응답으로 새어 나가기도 합니다.
     */
    @Transactional(readOnly = true)
    public MapPerfumeDetailResponse getPerfume(Long perfumeId) {
        return scentMapRepository.findPerfume(perfumeId)
                .orElseThrow(() -> new BusinessException(MapErrorCode.MAP_PERFUME_NOT_FOUND));
    }

    /**
     * 저장된 폴리곤 JSON 을 그대로 응답에 실어 보냅니다.
     *
     * <p>JSON 으로 되돌리기만 하고 꼭짓점을 자바 타입으로 옮기지 않습니다. 서버가 좌표를 볼 일이
     * 없고, 옮겨 담으면 계열 9개에 1692개를 옮긴 뒤 다시 직렬화하게 됩니다.
     *
     * <p>읽을 수 없는 JSON 이 들어 있으면 적재가 잘못된 것입니다. 그 계열만 빼고 지도를 그리면
     * 영역 하나가 조용히 사라지므로, 실패로 처리해 적재를 고치게 합니다.
     */
    private ScentRegionResponse toRegion(ScentRegionRow row) {
        return new ScentRegionResponse(
                row.scentRegionId(),
                row.code(),
                row.name(),
                row.displayOrder(),
                row.anchorX(),
                row.anchorY(),
                toPolygon(row)
        );
    }

    private JsonNode toPolygon(ScentRegionRow row) {
        if (row.polygonJson() == null) {
            return null;
        }
        try {
            return objectMapper.readTree(row.polygonJson());
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException(
                    "향 계열 영역의 polygon 을 읽을 수 없습니다: scentRegionId=" + row.scentRegionId(),
                    exception
            );
        }
    }
}
