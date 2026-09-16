package com.hyanghae.backend.community.service;

import com.hyanghae.backend.community.config.PostImageProperties;
import com.hyanghae.backend.community.exception.CommunityErrorCode;
import com.hyanghae.backend.global.exception.BusinessException;
import com.hyanghae.backend.global.exception.ErrorCode;
import com.hyanghae.backend.global.security.CurrentUser;
import com.hyanghae.backend.global.storage.ImageFileStorage;
import com.hyanghae.backend.global.storage.ImageStorageException;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

/**
 * 게시글에 붙일 이미지 파일을 받아 저장하고 주소를 돌려줍니다.
 *
 * <p>글쓰기와 분리된 이유는 순서 때문입니다. 화면은 글을 다 쓰기 전에 이미지를 먼저 붙여
 * 미리 보여줘야 하는데, 그 시점에는 글이 아직 없어 매달 대상이 없습니다. 그래서 파일을 먼저
 * 올려 주소를 받고, 글을 저장할 때 그 주소를 {@code imageUrls} 로 보냅니다.
 *
 * <p><b>올리기만 하고 글을 쓰지 않으면 파일은 남습니다.</b> 지금은 그대로 둡니다. 글에 한 번도
 * 걸리지 않은 파일이라 지울 근거가 생기지 않습니다. 보존 기간을 둔 청소 배치가 필요한데,
 * 먼저 쌓이는 양을 보고 주기를 정하는 편이 낫습니다.
 *
 * <p>글을 지우거나 이미지를 교체할 때의 정리는 {@code PostService} 가 합니다. 어떤 주소가 아직
 * 쓰이는지는 게시글 쪽만 알 수 있습니다.
 *
 * <p>저장 규칙 자체는 {@link ImageFileStorage} 가 갖고 있습니다. 프로필 이미지와 같은 규칙을
 * 써야 하는데 따로 두면 한쪽만 느슨해집니다. 여기서는 로그인 확인과 <b>도메인 에러 코드로
 * 바꾸는 일</b>만 합니다.
 */
@Service
public class PostImageService {

    private final ImageFileStorage storage;
    private final CurrentUser currentUser;

    public PostImageService(PostImageProperties properties, CurrentUser currentUser) {
        this.storage = new ImageFileStorage(
                properties.rootPath(), properties.urlPath(), properties.maxSize());
        this.currentUser = currentUser;
    }

    /**
     * 파일 하나를 저장하고 화면이 그대로 쓸 수 있는 주소를 돌려줍니다.
     */
    public String save(MultipartFile file) {
        requireLogin();
        try {
            return storage.save(file);
        } catch (ImageStorageException exception) {
            throw new BusinessException(errorCodeFor(exception.reason()));
        }
    }

    /**
     * 주소가 가리키는 파일을 지웁니다.
     *
     * <p><b>이 주소를 아직 쓰는 글이 없다는 것은 부르는 쪽이 확인해야 합니다.</b> 그리고
     * 트랜잭션이 커밋된 뒤에 불러야 합니다. 커밋 전에 지우면 롤백됐을 때 행은 살아 있는데
     * 파일만 없어져 글이 깨집니다.
     */
    public void delete(String imageUrl) {
        storage.delete(imageUrl);
    }

    /**
     * 저장소가 알려준 이유를 커뮤니티 도메인의 에러 코드로 바꿉니다.
     *
     * <p>저장소가 코드를 직접 정하지 않는 이유가 여기 있습니다. 같은 "너무 큼"이라도 게시글과
     * 프로필은 다른 코드로 나가야 화면이 어느 화면의 오류인지 구분할 수 있습니다.
     */
    private ErrorCode errorCodeFor(ImageStorageException.Reason reason) {
        return switch (reason) {
            case EMPTY -> CommunityErrorCode.COMMUNITY_IMAGE_EMPTY;
            case TOO_LARGE -> CommunityErrorCode.COMMUNITY_IMAGE_TOO_LARGE;
            case TYPE_NOT_ALLOWED -> CommunityErrorCode.COMMUNITY_IMAGE_TYPE_NOT_ALLOWED;
            case SAVE_FAILED -> CommunityErrorCode.COMMUNITY_IMAGE_SAVE_FAILED;
        };
    }

    private void requireLogin() {
        currentUser.id()
                .orElseThrow(() ->
                        new BusinessException(CommunityErrorCode.COMMUNITY_LOGIN_REQUIRED));
    }
}
