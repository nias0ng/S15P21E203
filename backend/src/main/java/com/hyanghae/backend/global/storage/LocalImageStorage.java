package com.hyanghae.backend.global.storage;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.util.unit.DataSize;
import org.springframework.web.multipart.MultipartFile;

/**
 * 이미지를 서버 디스크에 쌓고 애플리케이션이 직접 내주는 저장소입니다.
 *
 * <p>AWS 없이 동작해야 하는 곳에서 씁니다 — 로컬 개발과 테스트가 그렇습니다. 운영은
 * {@link S3ImageStorage} 를 씁니다.
 *
 * <p><b>서버가 한 대라는 전제가 깔려 있습니다.</b> 파일이 그 서버의 디스크에 있으므로 백엔드를
 * 여러 대로 늘리면 A 에 올린 이미지를 B 가 내주지 못합니다.
 */
public class LocalImageStorage extends ImageStorage {

    private static final Logger log = LoggerFactory.getLogger(LocalImageStorage.class);

    private final Path root;
    private final String urlPath;

    /**
     * @param root    파일을 쌓을 디렉터리입니다. 없으면 만듭니다.
     * @param urlPath 돌려줄 주소의 앞부분입니다. 저장소마다 달라야 합니다 — 같으면 한쪽의
     *                주소로 다른 쪽 파일을 가리킬 수 있고, 그쪽에서 지우라고 부르면 남의
     *                도메인 파일이 지워집니다.
     */
    public LocalImageStorage(Path root, String urlPath, DataSize maxSize) {
        super(maxSize);
        this.root = root.toAbsolutePath().normalize();
        this.urlPath = urlPath;
        createRoot();
    }

    @Override
    protected void put(MultipartFile file, String relativePath, ImageFormat format) {
        Path target = root.resolve(relativePath);
        try {
            Files.createDirectories(target.getParent());
            try (InputStream input = file.getInputStream()) {
                Files.copy(input, target, StandardCopyOption.REPLACE_EXISTING);
            }
        } catch (IOException exception) {
            log.error("Failed to store image: directory={}", root, exception);
            throw new ImageStorageException(ImageStorageException.Reason.SAVE_FAILED);
        }

        // 누가 올렸는지는 넣지 않습니다. 같은 줄에 requestId 가 찍히고, 그 값으로
        // RequestIdFilter 의 요청 로그를 찾으면 됩니다. 여기 한 번 더 적을 이유가 없습니다.
        // 보낸 파일 이름도 넣지 않습니다. 사용자가 적은 값이라 무엇이든 들어올 수 있습니다.
        log.debug(
                "Image stored: urlPath={}, format={}, sizeBytes={}, path={}",
                urlPath, format.name(), file.getSize(), relativePath);
    }

    @Override
    protected void remove(String relativePath) {
        try {
            boolean deleted = Files.deleteIfExists(root.resolve(relativePath));
            log.debug("Image deleted: deleted={}, path={}", deleted, relativePath);
        } catch (IOException exception) {
            log.warn("Failed to delete image: path={}", relativePath, exception);
        }
    }

    @Override
    protected String publicUrl(String relativePath) {
        return urlPath + "/" + relativePath;
    }

    /**
     * {@code normalize()} 뒤에 다시 루트 안인지 확인하는 것이 핵심입니다. 그러지 않으면
     * {@code ../} 가 섞인 주소를 저장해 두고 그것을 지우라고 부르는 것만으로 서버의 다른
     * 파일을 지울 수 있습니다.
     */
    @Override
    protected String relativePathOf(String imageUrl) {
        if (imageUrl == null) {
            return null;
        }
        String prefix = urlPath + "/";
        if (!imageUrl.startsWith(prefix)) {
            return null;
        }
        String relativePath = imageUrl.substring(prefix.length());
        Path target = root.resolve(relativePath).normalize();
        return target.startsWith(root) ? relativePath : null;
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
}
