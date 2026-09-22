package com.hyanghae.backend.community.repository;

/**
 * 글 상세에 실을 작성자입니다.
 *
 * <p>닉네임과 프로필 사진을 <b>한 번에</b> 읽습니다. 둘을 따로 읽으면 같은 행을 두 번 보게 되고,
 * 사이에 사진이 바뀌면 한 응답 안에서 닉네임과 사진이 다른 시점의 것이 됩니다.
 *
 * <p>인터페이스인 이유는 네이티브 결과를 레코드 생성자로 바로 받을 수 없기 때문입니다. Spring
 * Data 가 컬럼 별칭을 보고 구현을 만들어 줍니다.
 *
 * <p>작성자가 탈퇴했으면 이 줄 자체가 없습니다. 글은 남고 작성자만 지워집니다.
 */
public interface PostAuthorRow {

    String getNickname();

    /** 사진을 설정하지 않았으면 비어 있습니다. */
    String getProfileImageUrl();
}
