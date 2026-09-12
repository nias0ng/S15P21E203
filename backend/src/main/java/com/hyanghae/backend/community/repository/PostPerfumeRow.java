package com.hyanghae.backend.community.repository;

import com.hyanghae.backend.community.dto.response.PostPerfumeResponse;

/** 어느 글의 대표 향수인지입니다. 서비스가 글 번호로 묶어 목록에 끼웁니다. */
public record PostPerfumeRow(Long postId, PostPerfumeResponse perfume) {
}
