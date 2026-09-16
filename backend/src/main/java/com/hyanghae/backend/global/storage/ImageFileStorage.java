package com.hyanghae.backend.global.storage;

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
import org.springframework.util.unit.DataSize;
import org.springframework.web.multipart.MultipartFile;

/**
 * 올라온 이미지 파일을 서버 디스크에 쌓고 주소로 돌려주는 저장소입니다.
 *
 * <p>쓰는 곳이 둘이라 여기 있습니다 — 게시글 이미지와 프로필 이미지. 저장 규칙(형식 판별,
 * 이름 짓기, 경로 탈출 방어)이 같아야 하는데 도메인마다 따로 쓰면 한쪽만 느슨해집니다.
 * 반대로 <b>어디에 쌓을지와 무엇을 에러로 부를지는 도메인마다 다릅니다.</b> 그래서 경로와
 * 제한은 생성자로 받고, 에러는 {@link ImageStorageException.Reason} 으로만 알려줍니다.
 *
 * <p>스프링 빈이 아닙니다. 도메인마다 설정이 달라 빈 하나로는 둘을 못 담습니다. 각 도메인의
 * 서비스가 자기 설정으로 하나씩 만들어 씁니다.
 *
 * <p><b>트랜잭션이 없습니다.</b> 파일 쓰기는 데이터베이스가 아니라 되돌릴 수 없습니다. 쓰기와
 * 지우기의 순서는 부르는 쪽이 정해야 합니다 — 지우기는 트랜잭션이 커밋된 뒤에 부르십시오.
 * 커밋 전에 지우면 롤백됐을 때 행은 살아 있는데 파일만 없어집니다.
 */
public class ImageFileStorage {

    private static final Logger log = LoggerFactory.getLogger(ImageFileStorage.class);

    /**
     * 날짜로 디렉터리를 나눕니다. 한 디렉터리에 파일이 수만 개 쌓이면 목록을 보거나 옮길 때
     * 도구들이 눈에 띄게 느려집니다. 문제가 생겼을 때 "며칠자 파일"로 범위를 좁힐 수도 있습니다.
     */
    private static final DateTimeFormatter DATE_DIRECTORY = DateTimeFormatter.ofPattern("yyyy/MM");

    private final Path root;
    private final String urlPath;
    private final long maxBytes;

    /**
     * @param root    파일을 쌓을 디렉터리입니다. 없으면 만듭니다.
     * @param urlPath 돌려줄 주소의 앞부분입니다. 저장소마다 달라야 합니다 — 같으면 한쪽의
     *                주소로 다른 쪽 파일을 가리킬 수 있고, 그쪽에서 지우라고 부르면 남의
     *                도메인 파일이 지워집니다.
     * @param maxSize 파일 하나의 최대 크기입니다.
     */
    public ImageFileStorage(Path root, String urlPath, DataSize maxSize) {
        this.root = root.toAbsolutePath().normalize();
        this.urlPath = urlPath;
        this.maxBytes = maxSize.toBytes();
        createRoot();
    }

    /**
     * 파일 하나를 저장하고 화면이 그대로 쓸 수 있는 주소를 돌려줍니다.
     *
     * <p>파일 이름은 우리가 새로 짓습니다. 보낸 이름을 쓰면 두 가지가 깨집니다. 같은 이름을
     * 올린 다른 사람의 파일을 덮어쓰고, {@code ../../} 같은 이름으로 저장 위치를 벗어날 수
     * 있습니다. 확장자도 보낸 값이 아니라 파일 내용에서 알아낸 형식으로 붙입니다.
     *
     * @throws ImageStorageException 비었거나, 너무 크거나, 아는 형식이 아니거나, 쓰지 못했을 때
     */
    public String save(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new ImageStorageException(ImageStorageException.Reason.EMPTY);
        }
        if (file.getSize() > maxBytes) {
            throw new ImageStorageException(ImageStorageException.Reason.TOO_LARGE);
        }

        ImageFormat format = ImageFormat.detect(readHead(file))
                .orElseThrow(() -> new ImageStorageException(
                        ImageStorageException.Reason.TYPE_NOT_ALLOWED));

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
                "Image stored: urlPath={}, format={}, sizeBytes={}, path={}",
                urlPath,
                format.name(),
                file.getSize(),
                relativePath
        );

        return urlPath + "/" + relativePath;
    }

    /**
     * 주소가 가리키는 파일을 지웁니다.
     *
     * <p><b>이 주소를 아직 쓰는 곳이 없다는 것은 부르는 쪽이 확인해야 합니다.</b> 여기서는
     * 세지 않습니다. 무엇이 무엇을 참조하는지는 도메인마다 다릅니다 — 게시글은
     * {@code post_images} 를 세고, 프로필은 컬럼 하나라 셀 것이 없습니다.
     *
     * <p>이 저장소가 만들지 않은 주소는 조용히 지나갑니다. 주소는 결국 문자열이고 화면이
     * 보내는 값이라, {@code ../} 가 섞인 주소나 다른 저장소의 주소가 들어올 수 있습니다.
     *
     * <p>지우지 못해도 예외를 던지지 않습니다. 부르는 쪽은 이미 커밋을 마친 뒤라, 여기서
     * 실패를 올리면 사용자는 이미 처리된 일에 대해 오류를 받습니다. 파일이 남는 것은 나중에
     * 치울 수 있지만 그 오류는 되돌릴 수 없습니다.
     */
    public void delete(String imageUrl) {
        Path target = resolveStoredFile(imageUrl);
        if (target == null) {
            return;
        }
        try {
            boolean deleted = Files.deleteIfExists(target);
            log.debug("Image deleted: deleted={}, url={}", deleted, imageUrl);
        } catch (IOException exception) {
            log.warn("Failed to delete image: url={}", imageUrl, exception);
        }
    }

    /**
     * 주소를 이 저장소 안의 파일로 바꿉니다. 이 저장소 것이 아니면 {@code null} 입니다.
     *
     * <p>{@code normalize()} 뒤에 다시 루트 안인지 확인하는 것이 핵심입니다. 그러지 않으면
     * {@code ../} 가 섞인 주소를 저장해 두고 그것을 지우라고 부르는 것만으로 서버의 다른
     * 파일을 지울 수 있습니다.
     */
    private Path resolveStoredFile(String imageUrl) {
        if (imageUrl == null) {
            return null;
        }
        String prefix = urlPath + "/";
        if (!imageUrl.startsWith(prefix)) {
            return null;
        }
        Path target = root.resolve(imageUrl.substring(prefix.length())).normalize();
        return target.startsWith(root) ? target : null;
    }

    /**
     * 형식 판별에 필요한 앞부분만 읽습니다. 파일을 통째로 메모리에 올릴 이유가 없습니다.
     *
     * <p>{@code read} 한 번이 요청한 만큼 다 준다는 보장이 없어 {@code readNBytes} 를 씁니다.
     * 시그니처보다 짧은 파일이면 읽힌 만큼만 돌아오고, 그런 파일은 어느 형식과도 맞지 않습니다.
     */
    private byte[] readHead(MultipartFile file) {
        try (InputStream input = file.getInputStream()) {
            return input.readNBytes(ImageFormat.SIGNATURE_LENGTH);
        } catch (IOException exception) {
            throw saveFailed("Failed to read uploaded image", exception);
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
            throw saveFailed("Failed to store image", exception);
        }
    }

    /**
     * 만들 때 저장 디렉터리를 만듭니다.
     *
     * <p>여기서 실패하면 애플리케이션이 뜨지 않습니다. 첫 업로드 때 500 을 보고 알아채는 것보다
     * 배포 시점에 실패하는 편이 낫습니다. 권한이나 볼륨 설정이 잘못된 것은 요청으로 고칠 수
     * 있는 문제가 아닙니다.
     */
    private void createRoot() {
        try {
            Files.createDirectories(root);
        } catch (IOException exception) {
            throw new IllegalStateException("Cannot create image directory: " + root, exception);
        }
    }

    /**
     * 디스크 문제는 예상한 흐름이 아니므로 원인을 남깁니다. 응답에는 공용 메시지만 나갑니다.
     */
    private ImageStorageException saveFailed(String message, IOException exception) {
        log.error("{}: directory={}", message, root, exception);
        return new ImageStorageException(ImageStorageException.Reason.SAVE_FAILED);
    }
}
