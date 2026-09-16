package com.hyanghae.backend.community.service;

import com.hyanghae.backend.community.config.PostImageProperties;
import com.hyanghae.backend.community.exception.CommunityErrorCode;
import com.hyanghae.backend.global.exception.BusinessException;
import com.hyanghae.backend.global.security.CurrentUser;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

/**
 * 게시글에 붙일 이미지 파일을 받아 서버에 저장하고 주소를 돌려줍니다.
 *
 * <p>글쓰기와 분리된 이유는 순서 때문입니다. 화면은 글을 다 쓰기 전에 이미지를 먼저 붙여
 * 미리 보여줘야 하는데, 그 시점에는 글이 아직 없어 매달 대상이 없습니다. 그래서 파일을 먼저
 * 올려 주소를 받고, 글을 저장할 때 그 주소를 {@code imageUrls} 로 보냅니다.
 *
 * <p><b>올리기만 하고 글을 쓰지 않으면 파일은 남습니다.</b> 지금은 그대로 둡니다. 지우려면
 * 어떤 파일이 어느 글에 쓰였는지 추적해야 하는데, 글 작성 전에는 그 연결이 없어 "아무 글도
 * 안 쓴 파일"과 "방금 올려 곧 쓸 파일"을 구분할 수 없습니다. 먼저 쌓이는 양을 보고 정하는
 * 편이 낫습니다.
 *
 * <p>트랜잭션이 없습니다. 파일 쓰기는 데이터베이스가 아니라 되돌릴 수 없고, 되돌릴 것도
 * 없습니다. 주소를 받은 쪽이 글을 쓰지 않으면 위에 적은 대로 파일만 남습니다.
 */
@Service
public class PostImageService {

    private static final Logger log = LoggerFactory.getLogger(PostImageService.class);

    /**
     * 날짜로 디렉터리를 나눕니다. 한 디렉터리에 파일이 수만 개 쌓이면 목록을 보거나 옮길 때
     * 도구들이 눈에 띄게 느려집니다. 문제가 생겼을 때 "며칠자 파일"로 범위를 좁힐 수도 있습니다.
     */
    private static final DateTimeFormatter DATE_DIRECTORY = DateTimeFormatter.ofPattern("yyyy/MM");

    private final PostImageProperties properties;
    private final CurrentUser currentUser;
    private final Path root;

    public PostImageService(PostImageProperties properties, CurrentUser currentUser) {
        this.properties = properties;
        this.currentUser = currentUser;
        this.root = properties.rootPath();
        createRoot();
    }

    /**
     * 파일 하나를 저장하고 화면이 그대로 쓸 수 있는 주소를 돌려줍니다.
     *
     * <p>파일 이름은 우리가 새로 짓습니다. 보낸 이름을 쓰면 두 가지가 깨집니다. 같은 이름을
     * 올린 다른 사람의 파일을 덮어쓰고, {@code ../../} 같은 이름으로 저장 위치를 벗어날 수
     * 있습니다. 확장자도 보낸 값이 아니라 파일 내용에서 알아낸 형식으로 붙입니다.
     */
    public String save(MultipartFile file) {
        requireLogin();

        if (file == null || file.isEmpty()) {
            throw new BusinessException(CommunityErrorCode.COMMUNITY_IMAGE_EMPTY);
        }
        if (file.getSize() > properties.maxSize().toBytes()) {
            throw new BusinessException(CommunityErrorCode.COMMUNITY_IMAGE_TOO_LARGE);
        }

        PostImageFormat format = PostImageFormat.detect(readHead(file))
                .orElseThrow(() ->
                        new BusinessException(CommunityErrorCode.COMMUNITY_IMAGE_TYPE_NOT_ALLOWED));

        String relativePath = "%s/%s.%s".formatted(
                LocalDate.now().format(DATE_DIRECTORY),
                UUID.randomUUID(),
                format.extension()
        );
        store(file, relativePath);

        // 누가 올렸는지는 넣지 않습니다. 같은 줄에 requestId 가 찍히고, 그 값으로
        // RequestIdFilter 의 요청 로그를 찾으면 됩니다. 여기 한 번 더 적을 이유가 없습니다.
        // 보낸 파일 이름도 넣지 않습니다. 사용자가 적은 값이라 무엇이든 들어올 수 있습니다.
        log.debug(
                "Post image stored: format={}, sizeBytes={}, path={}",
                format.name(),
                file.getSize(),
                relativePath
        );

        return properties.urlPath() + "/" + relativePath;
    }

    /**
     * 주소가 가리키는 파일을 지웁니다. 글이 지워지거나 이미지가 교체될 때 부릅니다.
     *
     * <p><b>이 주소를 아직 쓰는 글이 없다는 것은 부르는 쪽이 확인해야 합니다.</b> 여기서는
     * 세지 않습니다. 파일만 아는 자리가 게시글 테이블을 뒤지기 시작하면 저장소를 S3 로 옮길 때
     * 같이 끌려옵니다.
     *
     * <p>우리가 만들지 않은 주소는 조용히 지나갑니다. {@code imageUrls} 는 문자열이라 외부
     * 주소나 옛 경로가 들어 있을 수 있고, 그런 주소로 디스크를 건드리면 안 됩니다.
     *
     * <p>지우지 못해도 예외를 던지지 않습니다. 부르는 쪽은 이미 글을 지운 뒤라, 여기서 실패를
     * 올리면 사용자는 지워진 글에 대해 오류를 받습니다. 파일이 남는 것은 나중에 치울 수
     * 있지만 그 오류는 되돌릴 수 없습니다.
     */
    public void delete(String imageUrl) {
        Path target = resolveStoredFile(imageUrl);
        if (target == null) {
            return;
        }
        try {
            boolean deleted = Files.deleteIfExists(target);
            log.debug("Post image deleted: deleted={}, url={}", deleted, imageUrl);
        } catch (IOException exception) {
            log.warn("Failed to delete post image: url={}", imageUrl, exception);
        }
    }

    /**
     * 주소를 우리 저장 디렉터리 안의 파일로 바꿉니다. 우리 것이 아니면 {@code null} 입니다.
     *
     * <p>{@code normalize()} 뒤에 다시 루트 안인지 확인하는 것이 핵심입니다. 주소는 결국
     * 문자열이고 {@code imageUrls} 는 화면이 보내는 값이라, {@code ../} 가 섞인 주소를 글에
     * 넣어 두고 그 글을 지우는 것만으로 서버의 다른 파일을 지울 수 있습니다.
     */
    private Path resolveStoredFile(String imageUrl) {
        if (imageUrl == null) {
            return null;
        }
        String prefix = properties.urlPath() + "/";
        if (!imageUrl.startsWith(prefix)) {
            return null;
        }
        Path target = root.resolve(imageUrl.substring(prefix.length())).normalize();
        return target.startsWith(root) ? target : null;
    }

    /**
     * 형식 판별에 필요한 앞부분만 읽습니다. 5MB 파일을 통째로 메모리에 올릴 이유가 없습니다.
     *
     * <p>{@code read} 한 번이 요청한 만큼 다 준다는 보장이 없어 {@code readNBytes} 를 씁니다.
     * 시그니처보다 짧은 파일이면 읽힌 만큼만 돌아오고, 그런 파일은 어느 형식과도 맞지 않습니다.
     */
    private byte[] readHead(MultipartFile file) {
        try (InputStream input = file.getInputStream()) {
            return input.readNBytes(PostImageFormat.SIGNATURE_LENGTH);
        } catch (IOException exception) {
            throw saveFailed("Failed to read uploaded post image", exception);
        }
    }

    private void store(MultipartFile file, String relativePath) {
        Path target = root.resolve(relativePath);
        try {
            Files.createDirectories(target.getParent());
            try (InputStream input = file.getInputStream()) {
                Files.copy(input, target, StandardCopyOption.REPLACE_EXISTING);
            }
        } catch (IOException exception) {
            throw saveFailed("Failed to store post image", exception);
        }
    }

    /**
     * 시작할 때 저장 디렉터리를 만듭니다.
     *
     * <p>여기서 실패하면 애플리케이션이 뜨지 않습니다. 첫 업로드 때 500 을 보고 알아채는 것보다
     * 배포 시점에 실패하는 편이 낫습니다. 권한이나 볼륨 설정이 잘못된 것은 요청으로 고칠 수
     * 있는 문제가 아닙니다.
     */
    private void createRoot() {
        try {
            Files.createDirectories(root);
        } catch (IOException exception) {
            throw new IllegalStateException(
                    "Cannot create post image directory: " + root, exception);
        }
    }

    /**
     * 디스크 문제는 예상한 흐름이 아니므로 원인을 남깁니다. 응답에는 공용 메시지만 나갑니다.
     */
    private BusinessException saveFailed(String message, IOException exception) {
        log.error("{}: directory={}", message, root, exception);
        return new BusinessException(CommunityErrorCode.COMMUNITY_IMAGE_SAVE_FAILED);
    }

    private Long requireLogin() {
        return currentUser.id()
                .orElseThrow(() ->
                        new BusinessException(CommunityErrorCode.COMMUNITY_LOGIN_REQUIRED));
    }
}
