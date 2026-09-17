package com.hyanghae.backend.global.storage;

import java.io.IOException;
import java.io.InputStream;
import org.springframework.web.multipart.MultipartFile;

/**
 * 형식 판별에 필요한 파일 앞부분만 읽습니다.
 *
 * <p>파일을 통째로 메모리에 올릴 이유가 없습니다. 파일이 아무리 커도 여기서 읽는 것은
 * {@link ImageFormat#SIGNATURE_LENGTH} 바이트뿐입니다.
 */
final class ImageHead {

    private ImageHead() {
    }

    /**
     * {@code read} 한 번이 요청한 만큼 다 준다는 보장이 없어 {@code readNBytes} 를 씁니다.
     * 시그니처보다 짧은 파일이면 읽힌 만큼만 돌아오고, 그런 파일은 어느 형식과도 맞지 않습니다.
     */
    static byte[] of(MultipartFile file) {
        try (InputStream input = file.getInputStream()) {
            return input.readNBytes(ImageFormat.SIGNATURE_LENGTH);
        } catch (IOException exception) {
            throw new ImageStorageException(ImageStorageException.Reason.SAVE_FAILED);
        }
    }
}
