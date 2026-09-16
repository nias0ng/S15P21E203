package com.hyanghae.backend.perfume.repository;

/**
 * Fragrantica 번호로 찾은 향수의 표시 정보입니다.
 *
 * <p>자연어 추천이 씁니다. AI 서버가 {@code fragranticaId} 로 향수를 지목하면 백엔드가 이
 * 조회로 {@code perfumeId} 와 이름·브랜드를 채웁니다. {@code fragranticaId} 를 함께 돌려주는
 * 이유는, 호출한 쪽이 AI 가 정한 순서대로 결과를 다시 세워야 하기 때문입니다. {@code IN} 절의
 * 결과 순서는 보낸 순서와 무관합니다.
 *
 * <p>이름이 둘, 브랜드 이름도 둘입니다. 한국어 이름이 아직 대부분 비어 있어 화면에 영문이
 * 나가는데, 고르는 일은 호출한 쪽에 맡깁니다. {@code name_ko} 가 채워지면 응답이 저절로
 * 한국어로 바뀝니다.
 *
 * <p>브랜드는 {@code null} 일 수 있습니다. {@code brand_id} 가 nullable 입니다.
 */
public record PerfumeIdentity(
        Long fragranticaId,
        Long perfumeId,
        String name,
        String nameKo,
        String brandName,
        String brandNameKo
) {
}
