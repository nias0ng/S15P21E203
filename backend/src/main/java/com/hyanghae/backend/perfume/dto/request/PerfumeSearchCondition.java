package com.hyanghae.backend.perfume.dto.request;

import com.hyanghae.backend.perfume.entity.Gender;

/**
 * 향수 검색 조건입니다. 쿼리 파라미터를 {@code @ModelAttribute} 로 받습니다.
 *
 * <p>세 값 모두 선택입니다. 함께 오면 AND 로 걸립니다. 예를 들어 {@code keyword=bleu&brand=Chanel}
 * 은 "샤넬 향수 중 bleu 가 들어간 것"입니다.
 *
 * <p>{@code brand} 는 완전 일치입니다. 브랜드 페이지에서 카드를 눌러 넘어오는 흐름이라 부분 일치가
 * 필요하지 않습니다. 브랜드명 부분 일치는 {@code keyword} 가 이미 처리합니다.
 *
 * <p>{@code gender} 를 문자열이 아니라 enum 으로 받습니다. 값이 잘못되면 조용히 0건이 나가는 대신
 * 400 이 됩니다. 필터가 안 걸린 것인지 해당하는 향수가 없는 것인지 구분할 수 있어야 합니다.
 *
 * <p>{@code shelf} 만 성격이 다릅니다. 향수의 속성이 아니라 요청한 사용자와의 관계라서 로그인이
 * 필요합니다. 비로그인 요청에 이 값이 오면 401 입니다.
 */
public record PerfumeSearchCondition(String keyword, String brand, Gender gender, ShelfFilter shelf) {
}
