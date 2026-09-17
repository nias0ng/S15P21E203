package com.hyanghae.backend.global.storage;

/**
 * 이미지를 저장하지 못한 이유입니다.
 *
 * <p><b>도메인 에러 코드를 여기서 정하지 않습니다.</b> 같은 "너무 큼"이라도 게시글은
 * {@code COMMUNITY_IMAGE_TOO_LARGE}, 프로필은 {@code USER_PROFILE_IMAGE_TOO_LARGE} 로 나가야
 * 화면이 어느 화면의 오류인지 구분할 수 있습니다. 저장소가 하나의 코드를 정해 버리면 그
 * 구분이 사라집니다.
 *
 * <p>그래서 이유만 알려주고, 부르는 쪽이 자기 도메인의 {@code ErrorCode} 로 바꿔
 * {@code BusinessException} 을 던집니다.
 */
public class ImageStorageException extends RuntimeException {

    /** 저장에 실패한 이유입니다. 부르는 쪽이 이 값으로 자기 에러 코드를 고릅니다. */
    public enum Reason {

        /** 파일을 보내지 않았거나 빈 파일입니다. */
        EMPTY,

        /** 정해 둔 크기 제한을 넘었습니다. */
        TOO_LARGE,

        /** 아는 이미지 형식이 아닙니다. 확장자가 아니라 파일 내용으로 판별한 결과입니다. */
        TYPE_NOT_ALLOWED,

        /** 디스크에 쓰지 못했습니다. 보낸 쪽 잘못이 아닙니다. */
        SAVE_FAILED
    }

    private final transient Reason reason;

    public ImageStorageException(Reason reason) {
        super(reason.name());
        this.reason = reason;
    }

    public Reason reason() {
        return reason;
    }
}
