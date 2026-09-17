package com.hyanghae.backend.collection.repository;

/**
 * 어느 컬렉션에 어느 향수가 담겼는지입니다. 목록의 미리보기 사진을 채울 때 씁니다.
 *
 * <p>컬렉션 한 건에 여러 행이 나오고, 컬렉션 안에서는 담긴 순서대로 옵니다.
 */
public record CollectionPerfumeRow(Long collectionId, Long perfumeId) {
}
