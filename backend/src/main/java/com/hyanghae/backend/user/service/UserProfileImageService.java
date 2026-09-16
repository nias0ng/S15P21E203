package com.hyanghae.backend.user.service;

import com.hyanghae.backend.auth.exception.AuthErrorCode;
import com.hyanghae.backend.global.exception.BusinessException;
import com.hyanghae.backend.global.exception.ErrorCode;
import com.hyanghae.backend.global.security.CurrentUser;
import com.hyanghae.backend.global.storage.ImageFileStorage;
import com.hyanghae.backend.global.storage.ImageStorageException;
import com.hyanghae.backend.user.config.UserProfileImageProperties;
import com.hyanghae.backend.user.entity.User;
import com.hyanghae.backend.user.exception.UserErrorCode;
import com.hyanghae.backend.user.repository.UserRepository;
import java.time.OffsetDateTime;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.multipart.MultipartFile;

/**
 * 프로필 사진을 올리고 내립니다.
 *
 * <p><b>게시글 이미지와 달리 한 번에 끝납니다.</b> 게시글은 글이 만들어지기 전에 미리보기를
 * 보여줘야 해서 "올려서 주소 받기"와 "글에 매달기"가 나뉘었습니다. 프로필은 매달 사용자가
 * 이미 있으므로 나눌 이유가 없습니다. 나누면 올려 놓고 적용하지 않은 파일이 남는 문제만
 * 따라옵니다 — 한 번에 하면 그런 파일이 아예 생기지 않습니다.
 *
 * <p>옛 사진은 새 사진으로 바꾸거나 내릴 때 지웁니다. 게시글과 달리 참조 수를 세지 않습니다.
 * 주소가 컬럼 하나에만 들어가고 그 값을 정하는 것은 서버라, 같은 주소를 두 사람이 나눠 쓰는
 * 일이 생기지 않습니다.
 */
@Service
public class UserProfileImageService {

    private static final Logger log = LoggerFactory.getLogger(UserProfileImageService.class);

    private final ImageFileStorage storage;
    private final UserRepository userRepository;
    private final CurrentUser currentUser;

    public UserProfileImageService(
            UserProfileImageProperties properties,
            UserRepository userRepository,
            CurrentUser currentUser
    ) {
        this.storage = new ImageFileStorage(
                properties.rootPath(), properties.urlPath(), properties.maxSize());
        this.userRepository = userRepository;
        this.currentUser = currentUser;
    }

    /**
     * 프로필 사진을 올리고 바로 내 계정에 붙입니다. 쓰던 사진이 있으면 그 파일을 지웁니다.
     *
     * <p>파일을 먼저 저장하고 나서 컬럼을 고칩니다. 순서가 반대면 컬럼이 가리키는 파일이 아직
     * 없는 순간이 생깁니다. 반대로 이 순서에서 뒤가 실패하면 파일만 남는데, 그것은 나중에
     * 치울 수 있습니다.
     */
    @Transactional
    public String upload(MultipartFile file) {
        User user = requireCurrentUser();
        String oldImageUrl = user.getProfileImageUrl();

        String imageUrl;
        try {
            imageUrl = storage.save(file);
        } catch (ImageStorageException exception) {
            throw new BusinessException(errorCodeFor(exception.reason()));
        }

        user.changeProfileImage(imageUrl, OffsetDateTime.now());
        deleteAfterCommit(oldImageUrl);

        return imageUrl;
    }

    /**
     * 프로필 사진을 내립니다. 화면은 다시 기본 아바타를 보여줍니다.
     *
     * <p>쓰던 사진이 없어도 오류가 아닙니다. 여러 번 눌러도 결과가 같아야 합니다.
     */
    @Transactional
    public void remove() {
        User user = requireCurrentUser();
        String oldImageUrl = user.getProfileImageUrl();

        user.changeProfileImage(null, OffsetDateTime.now());
        deleteAfterCommit(oldImageUrl);
    }

    /**
     * 탈퇴할 때 쓰던 사진을 지웁니다. {@code UserService} 가 회원을 지운 뒤 부릅니다.
     *
     * <p>따로 두는 이유는 탈퇴가 비밀번호 확인과 세션 정리까지 하는 별개의 흐름이라서입니다.
     * 여기서 회원을 지우게 하면 같은 일이 두 곳에 생깁니다.
     */
    public void removeAfterWithdrawal(String imageUrl) {
        deleteAfterCommit(imageUrl);
    }

    /**
     * 쓰이지 않게 된 파일을 <b>커밋된 뒤에</b> 지웁니다.
     *
     * <p>트랜잭션 안에서 지우면 뒤늦게 롤백됐을 때 컬럼은 옛 주소를 가리키는데 파일만 없어져
     * 사진이 깨집니다. 커밋 뒤면 최악이라도 파일이 남을 뿐이고, 남은 파일은 나중에 치울 수
     * 있습니다. 되돌릴 수 없는 쪽을 피하는 것입니다.
     *
     * <p>여기서 무엇이 실패해도 요청은 성공입니다. 사용자가 요청한 일은 이미 커밋됐고, 파일
     * 정리가 안 됐다고 그것을 되돌릴 수는 없습니다.
     */
    private void deleteAfterCommit(String imageUrl) {
        if (imageUrl == null) {
            return;
        }
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            // 탈퇴처럼 트랜잭션 밖에서 부르는 경로입니다. 이미 커밋이 끝난 뒤라 바로 지웁니다.
            storage.delete(imageUrl);
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                try {
                    storage.delete(imageUrl);
                } catch (RuntimeException exception) {
                    log.warn("Failed to clean up profile image file", exception);
                }
            }
        });
    }

    /**
     * 저장소가 알려준 이유를 회원 도메인의 에러 코드로 바꿉니다.
     *
     * <p>게시글과 다른 코드로 나가야 화면이 어느 화면의 오류인지 구분할 수 있습니다.
     */
    private ErrorCode errorCodeFor(ImageStorageException.Reason reason) {
        return switch (reason) {
            case EMPTY -> UserErrorCode.USER_PROFILE_IMAGE_EMPTY;
            case TOO_LARGE -> UserErrorCode.USER_PROFILE_IMAGE_TOO_LARGE;
            case TYPE_NOT_ALLOWED -> UserErrorCode.USER_PROFILE_IMAGE_TYPE_NOT_ALLOWED;
            case SAVE_FAILED -> UserErrorCode.USER_PROFILE_IMAGE_SAVE_FAILED;
        };
    }

    /**
     * 로그인과 회원 조회는 {@code UserService} 와 같은 코드를 씁니다. 두 곳이 서로 다른 코드를
     * 내보내면 화면이 같은 상황을 두 가지로 처리해야 합니다.
     */
    private User requireCurrentUser() {
        Long userId = currentUser.id()
                .orElseThrow(() -> new BusinessException(AuthErrorCode.AUTH_LOGIN_REQUIRED));
        return userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(AuthErrorCode.AUTH_USER_NOT_FOUND));
    }
}
