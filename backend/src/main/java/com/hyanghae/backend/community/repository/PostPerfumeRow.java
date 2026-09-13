package com.hyanghae.backend.community.repository;

/** 어느 글의 대표 향수인지입니다. 서비스가 글 번호로 묶어 목록에 끼웁니다. */
public interface PostPerfumeRow {

    Long getPostId();

    Long getPerfumeId();

    String getName();

    String getBrand();
}
