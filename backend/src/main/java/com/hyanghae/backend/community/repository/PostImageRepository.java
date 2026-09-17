package com.hyanghae.backend.community.repository;

import com.hyanghae.backend.community.entity.PostImage;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * 게시글 이미지 행입니다.
 *
 * <p>행을 넣고 빼는 것은 {@code Post} 가 합니다({@code cascade} 와 {@code orphanRemoval}).
 * 여기는 <b>파일을 지워도 되는지</b> 확인하는 용도 하나뿐입니다.
 */
public interface PostImageRepository extends JpaRepository<PostImage, Long> {

    /**
     * 이 주소를 아직 쓰고 있는 글이 몇 개인지 셉니다.
     *
     * <p>주소는 올릴 때마다 새 UUID 라 보통 한 글에만 걸립니다. 그런데 주소는 문자열이라
     * <b>남의 글에 있는 주소를 복사해 자기 글에 붙일 수 있습니다.</b> 세어 보지 않고 지우면
     * 자기 글을 지우는 것만으로 남의 글 이미지를 깨뜨릴 수 있습니다.
     */
    long countByImageUrl(String imageUrl);
}
