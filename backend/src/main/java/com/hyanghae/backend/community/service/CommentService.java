package com.hyanghae.backend.community.service;

import com.hyanghae.backend.community.dto.request.CommentCreateRequest;
import com.hyanghae.backend.community.dto.request.CommentUpdateRequest;
import com.hyanghae.backend.community.dto.response.CommentCreateResponse;
import com.hyanghae.backend.community.dto.response.CommentResponse;
import com.hyanghae.backend.community.dto.response.CommentUpdateResponse;
import com.hyanghae.backend.community.dto.response.CommentsResponse;
import com.hyanghae.backend.community.entity.Comment;
import com.hyanghae.backend.community.entity.Post;
import com.hyanghae.backend.community.exception.CommunityErrorCode;
import com.hyanghae.backend.community.repository.CommentRepository;
import com.hyanghae.backend.community.repository.CommentRow;
import com.hyanghae.backend.community.repository.PostRepository;
import com.hyanghae.backend.global.exception.BusinessException;
import com.hyanghae.backend.global.security.CurrentUser;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Objects;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 댓글을 쓰고 고치고 지우고 읽습니다.
 *
 * <p>댓글은 <b>자유 게시판 글에만</b> 달립니다. 후기에는 댓글을 쓰지 않고 좋아요만 있습니다
 * (와이어프레임 A22a).
 *
 * <p>목록 조회는 로그인이 필요 없습니다. 다만 {@code mine} 은 보는 사람마다 달라지므로 로그인
 * 여부를 <b>참고</b>합니다. 로그인을 요구하는 것과 로그인 여부를 참고하는 것은 다릅니다.
 *
 * <p>수정과 삭제는 글을 묻지 않습니다. 댓글 번호만으로 이미 하나가 정해집니다.
 */
@Service
public class CommentService {

    private static final int MAX_PAGE_SIZE = 100;

    private final CommentRepository commentRepository;
    private final PostRepository postRepository;
    private final CurrentUser currentUser;

    public CommentService(
            CommentRepository commentRepository,
            PostRepository postRepository,
            CurrentUser currentUser
    ) {
        this.commentRepository = commentRepository;
        this.postRepository = postRepository;
        this.currentUser = currentUser;
    }

    /**
     * 댓글을 씁니다. 없는 글에는 달 수 없습니다.
     *
     * <p>글을 번호만 확인하지 않고 실제로 읽어 옵니다. 어차피 댓글이 매달릴 대상이 필요하고,
     * 읽어 오는 것으로 존재 확인까지 끝납니다.
     */
    @Transactional
    public CommentCreateResponse create(Long postId, CommentCreateRequest request) {
        Long userId = requireLogin();
        Comment comment = Comment.onPost(
                requirePost(postId), userId, request.content(), OffsetDateTime.now());
        commentRepository.save(comment);

        return new CommentCreateResponse(comment.getId(), comment.getCreatedAt());
    }

    /**
     * 댓글 목록입니다. 오래된 순이고 페이지 크기는 1~100 으로 자릅니다.
     *
     * <p>글이 있는지 먼저 확인합니다. 확인하지 않으면 없는 글 번호로 조회해도 "댓글 0개" 가
     * 돌아가서, 화면이 "글이 없다" 와 "댓글이 없다" 를 구분하지 못합니다.
     */
    @Transactional(readOnly = true)
    public CommentsResponse findPage(Long postId, int page, int size) {
        requirePost(postId);

        int pageNumber = Math.max(page, 0);
        int pageSize = Math.clamp(size, 1, MAX_PAGE_SIZE);
        long offset = (long) pageNumber * pageSize;

        List<CommentRow> rows = commentRepository.findPageOfPost(postId, pageSize, offset);
        long total = commentRepository.countOfPost(postId);

        return new CommentsResponse(
                rows.stream().map(this::toResponse).toList(), pageNumber, pageSize, total);
    }

    /**
     * 댓글 내용을 고칩니다.
     *
     * <p>저장하라고 부르지 않습니다. 읽어 온 댓글의 필드를 바꾸면 트랜잭션이 끝날 때 반영됩니다.
     */
    @Transactional
    public CommentUpdateResponse update(Long commentId, CommentUpdateRequest request) {
        Comment comment = requireMyComment(commentId);
        comment.update(request.content(), OffsetDateTime.now());

        return new CommentUpdateResponse(comment.getId(), comment.getUpdatedAt());
    }

    /** 댓글을 지웁니다. */
    @Transactional
    public void delete(Long commentId) {
        commentRepository.delete(requireMyComment(commentId));
    }

    private CommentResponse toResponse(CommentRow row) {
        return new CommentResponse(
                row.getCommentId(),
                row.getNickname(),
                row.getProfileImageUrl(),
                row.getContent(),
                toOffsetDateTime(row.getCreatedAt()),
                toOffsetDateTime(row.getUpdatedAt()),
                isMine(row.getAuthorId())
        );
    }

    private OffsetDateTime toOffsetDateTime(Instant instant) {
        return instant == null ? null : OffsetDateTime.ofInstant(instant, ZoneId.systemDefault());
    }

    /**
     * 내가 쓴 댓글인지입니다. 화면이 수정·삭제 버튼을 띄울지 정하는 데 씁니다.
     *
     * <p>여기서는 로그인을 <b>요구하지 않습니다.</b> 비로그인이면 그냥 거짓입니다. 목록은 누구나
     * 볼 수 있어야 하므로 401 을 던지면 안 됩니다.
     *
     * <p>작성자가 탈퇴한 댓글은 주인이 없어 항상 거짓입니다.
     */
    private boolean isMine(Long authorId) {
        return authorId != null && currentUser.id().map(authorId::equals).orElse(false);
    }

    /** 댓글을 달 글이 있어야 합니다. */
    private Post requirePost(Long postId) {
        return postRepository.findById(postId)
                .orElseThrow(() ->
                        new BusinessException(CommunityErrorCode.COMMUNITY_POST_NOT_FOUND));
    }

    /**
     * 내가 쓴 댓글이어야 고치거나 지울 수 있습니다.
     *
     * <p>남의 댓글은 404 가 아니라 403 입니다. 댓글은 누구나 볼 수 있어 존재를 숨길 이유가 없고,
     * 404 로 답하면 "지워졌나" 와 "내 것이 아닌가" 를 화면이 구분하지 못합니다. 게시글과 같은
     * 기준입니다.
     *
     * <p>잠그고 읽습니다. 확인과 실제 수정 사이에 다른 요청이 같은 댓글을 지울 수 있기 때문입니다.
     * 사용자가 탭 두 개를 열어 두면 실제로 일어납니다.
     *
     * <p>작성자가 탈퇴한 댓글은 아무도 고칠 수 없습니다. 댓글은 남지만 주인이 없어집니다.
     */
    private Comment requireMyComment(Long commentId) {
        Comment comment = commentRepository.findForUpdate(commentId)
                .orElseThrow(() ->
                        new BusinessException(CommunityErrorCode.COMMUNITY_COMMENT_NOT_FOUND));

        if (!Objects.equals(comment.getUserId(), requireLogin())) {
            throw new BusinessException(CommunityErrorCode.COMMUNITY_COMMENT_NOT_OWNED);
        }
        return comment;
    }

    private Long requireLogin() {
        return currentUser.id()
                .orElseThrow(() ->
                        new BusinessException(CommunityErrorCode.COMMUNITY_LOGIN_REQUIRED));
    }
}
