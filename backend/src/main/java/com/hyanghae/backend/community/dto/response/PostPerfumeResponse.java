package com.hyanghae.backend.community.dto.response;

/** 글에 걸린 향수입니다. 화면이 이름과 브랜드를 같이 보여줍니다. */
public record PostPerfumeResponse(Long perfumeId, String name, String brandName) {
}
