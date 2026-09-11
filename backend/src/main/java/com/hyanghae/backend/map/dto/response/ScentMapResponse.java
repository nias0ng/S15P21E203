package com.hyanghae.backend.map.dto.response;

import java.util.List;

/**
 * 향 지도 한 장입니다. 계열 영역과 향수 좌표를 함께 내려줍니다.
 *
 * <p>지도 배경(땅·바다·해안선)은 여기 없습니다. 향수별 데이터가 아니라 지도를 128x108 칸으로 나눈
 * 격자라 조회할 조건이 없어 정적 파일로 내려주기로 정했습니다.
 *
 * <p>{@code regions} 는 조회 범위와 무관하게 활성 계열 전체입니다. 폴리곤이 지도 바깥까지 뻗어
 * 있어 범위로 자르면 모양이 깨지고, 계열은 9개뿐이라 잘라서 얻는 것도 없습니다.
 */
public record ScentMapResponse(
        List<ScentRegionResponse> regions,
        List<MapPerfumeResponse> perfumes
) {
}
