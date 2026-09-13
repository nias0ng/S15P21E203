package com.hyanghae.backend.community.repository;

import com.hyanghae.backend.community.entity.PostCategory;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

/**
 * 글 분류입니다.
 *
 * <p>코드로 찾습니다. 화면은 와이어프레임이 정한 코드만 알고 있고, 분류 번호는 자동 증가라
 * 환경마다 다릅니다.
 *
 * <p>내린 분류는 찾지 않습니다. 그런 분류로 새 글을 쓰게 두면 화면에 없는 탭이 생깁니다.
 */
@Repository
public interface PostCategoryRepository extends JpaRepository<PostCategory, Long> {

    Optional<PostCategory> findByCodeAndActiveTrue(String code);
}
