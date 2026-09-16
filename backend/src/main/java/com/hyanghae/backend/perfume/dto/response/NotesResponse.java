package com.hyanghae.backend.perfume.dto.response;

import java.util.List;

/**
 * 노트 전체입니다.
 *
 * <p>페이지가 없습니다. 화면이 대분류로 묶어 한 화면에 뿌리므로 전부가 있어야 합니다.
 *
 * <p>묶는 일은 화면이 합니다. 서버가 대분류별로 나눠 보내면 빈 대분류를 어떻게 다룰지, 순서를
 * 누가 정할지가 응답 모양에 얽힙니다. 목록은 이미 대분류 순으로 나가므로 화면이 이어서 끊으면
 * 됩니다.
 *
 * <p>노트가 없으면 빈 배열입니다. {@code null} 이 아닙니다.
 */
public record NotesResponse(List<NoteSummaryResponse> notes) {
}
