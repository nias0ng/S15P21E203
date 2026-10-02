package com.hyanghae.backend.map.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.Map;

/**
 * 취향 테스트가 향수를 고를 때 쓰는 계열 벡터입니다.
 *
 * <p>지도 조회({@code GET /api/v1/map})가 주는 향수와 다릅니다. 거기는 점을 찍고 이름을 띄우는
 * 값이라 대표 계열 <b>하나</b>만 담지만, 취향 테스트는 아홉 계열의 비중을 모두 놓고 코사인
 * 유사도를 재기 때문에 <b>전부</b> 필요합니다. 반대로 이름과 이미지는 결과 화면에 쓰지 않아
 * 담지 않습니다.
 *
 * <p>두 응답을 하나로 합치지 않은 이유는 수명이 다르기 때문입니다. 지도는 열 때마다 부르고
 * 취향 테스트는 가입할 때 한 번 부릅니다. 합치면 지도를 열 때마다 쓰지 않는 비중이 따라다닙니다.
 *
 * <p>{@code families} 의 <b>합이 1이 아닙니다.</b> 기준에 못 미치는 계열을 뺀 뒤 정규화하지
 * 않은 값이라 향수마다 0.2~1.0 사이입니다. {@code 1 - 합} 을 "기타 계열" 로 읽으면 안 됩니다.
 * 코사인 유사도는 벡터 크기에 영향을 받지 않아 정규화 없이 그대로 쓸 수 있습니다.
 *
 * <p>{@code rank} 는 국내 선정 순위입니다. 유사도가 같을 때 이 값이 작은 향수를 고릅니다.
 *
 * <p>{@code labelRegionCode} 는 그 향수가 <b>그려진 자리</b>의 계열입니다. 지도 조회의
 * {@code scentRegionId} 는 가장 센 계열이라 그려진 자리와 다를 수 있습니다(인계 데이터 200개 중
 * 47개). 취향 테스트는 1순위 계열이 이 값과 같은 향수만 결과로 고를 수 있습니다 — 저장할 때
 * 서버가 같은 판정으로 다시 확인합니다.
 */
public record ScentVectorResponse(
        @Schema(description = "향수 ID", example = "42")
        Long perfumeId,

        @Schema(description = "지도 x 좌표. 저장된 값 그대로 0~1 입니다. 지도 조회"
                + " (GET /api/v1/map) 와 같은 스케일입니다.", example = "0.09163")
        double x,

        @Schema(description = "지도 y 좌표. 0~0.83056 입니다.", example = "0.04484")
        double y,

        @Schema(description = "좌표가 이름표(anchorX·anchorY)가 있는 조각 안인 계열 코드."
                + " 떨어져 나온 작은 조각이나 계열 밖 바다면 null 입니다.",
                example = "WOODY", nullable = true)
        String labelRegionCode,

        @Schema(description = "국내 선정 순위 1~200. 유사도 동점을 가릅니다.", example = "1")
        int rank,

        @Schema(description = "계열 코드별 비중. 향수마다 1~3개이고 합은 1이 아닙니다.",
                example = "{\"MUSK\": 0.2309, \"WOODY\": 0.31}")
        Map<String, Double> families
) {
}
