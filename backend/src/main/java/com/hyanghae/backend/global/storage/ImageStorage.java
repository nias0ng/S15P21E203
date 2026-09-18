package com.hyanghae.backend.global.storage;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.UUID;
import org.springframework.util.unit.DataSize;
import org.springframework.web.multipart.MultipartFile;

/**
 * 올라온 이미지를 어딘가에 쌓고 주소로 돌려주는 저장소입니다.
 *
 * <p><b>검사와 이름 짓기는 여기서 끝냅니다.</b> 어디에 쌓느냐(로컬 디스크 · S3)와 무엇을
 * 검사하느냐는 별개인데, 구현마다 검사를 따로 두면 한쪽만 느슨해져 그쪽이 구멍이 됩니다.
 * 구현이 채우는 것은 "이 상대 경로에 이 바이트를 놓아라"와 "이 상대 경로를 지워라" 둘뿐입니다.
 *
 * <p>쓰는 곳이 둘(게시글 이미지 · 프로필 사진)이고 환경마다 뒤가 달라(로컬 · S3) 이 층이
 * 있습니다. 각 도메인의 서비스가 자기 설정으로 하나씩 만들어 씁니다.
 *
 * <p><b>트랜잭션이 없습니다.</b> 파일 쓰기는 데이터베이스가 아니라 되돌릴 수 없습니다. 지우기는
 * 트랜잭션이 커밋된 뒤에 부르십시오 — 커밋 전에 지우면 롤백됐을 때 행은 살아 있는데 파일만
 * 없어집니다.
 */
public abstract class ImageStorage {

    /**
     * 날짜로 경로를 나눕니다. 한 곳에 파일이 수만 개 쌓이면 목록을 보거나 옮길 때 도구들이
     * 눈에 띄게 느려집니다. 문제가 생겼을 때 "며칠자 파일"로 범위를 좁힐 수도 있습니다.
     */
    private static final DateTimeFormatter DATE_PATH = DateTimeFormatter.ofPattern("yyyy/MM");

    private final long maxBytes;

    protected ImageStorage(DataSize maxSize) {
        this.maxBytes = maxSize.toBytes();
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
    public final String save(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new ImageStorageException(ImageStorageException.Reason.EMPTY);
        }
        if (file.getSize() > maxBytes) {
            throw new ImageStorageException(ImageStorageException.Reason.TOO_LARGE);
        }

        ImageFormat format = ImageFormat.detect(ImageHead.of(file))
                .orElseThrow(() -> new ImageStorageException(
                        ImageStorageException.Reason.TYPE_NOT_ALLOWED));

        String relativePath = "%s/%s.%s".formatted(
                LocalDate.now().format(DATE_PATH),
                UUID.randomUUID(),
                format.extension()
        );
        put(file, relativePath, format);

        return publicUrl(relativePath);
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
    public final void delete(String imageUrl) {
        String relativePath = relativePathOf(imageUrl);
        if (relativePath == null) {
            return;
        }
        remove(relativePath);
    }

    /** 검사를 마친 파일을 정해진 상대 경로에 놓습니다. */
    protected abstract void put(MultipartFile file, String relativePath, ImageFormat format);

    /** 상대 경로의 파일을 지웁니다. 실패는 로그로만 남기고 예외를 올리지 않습니다. */
    protected abstract void remove(String relativePath);

    /** 상대 경로를 화면이 쓸 주소로 바꿉니다. */
    protected abstract String publicUrl(String relativePath);

    /**
     * 주소를 이 저장소 안의 상대 경로로 되돌립니다. 이 저장소 것이 아니면 {@code null} 입니다.
     */
    protected abstract String relativePathOf(String imageUrl);
}
