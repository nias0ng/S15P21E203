package com.hyanghae.backend.perfume.controller;

import com.hyanghae.backend.perfume.dto.response.NoteDetailResponse;
import com.hyanghae.backend.perfume.dto.response.NotesResponse;
import com.hyanghae.backend.perfume.dto.response.PerfumeSearchResponse;
import com.hyanghae.backend.perfume.service.NoteService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 노트 화면입니다(와이어프레임 A35 목록 · A36 상세).
 *
 * <p>노트는 향수에 매달리는 자료라 {@code perfume} 도메인에 둡니다. {@code Note} 엔티티와 향수
 * 상세의 향조 조회가 이미 여기 있습니다. 브랜드도 같은 이유로 여기 있습니다.
 *
 * <p>경로를 {@code /api/v1/perfumes} 아래가 아니라 따로 둡니다. 노트가 향수에 딸린 자료가 아니라
 * 그 자체로 목록과 상세를 갖는 자원이기 때문입니다. 향수의 향조를 읽는
 * {@code GET /api/v1/perfumes/{id}/notes} 는 그대로 있습니다 — 그쪽은 한 향수의 구성이고
 * 이쪽은 노트 자체입니다.
 *
 * <p>로그인이 필요 없습니다. 노트 화면은 누구나 볼 수 있어야 합니다.
 */
@Tag(name = "노트", description = "향조를 이루는 노트의 목록과 상세입니다.")
@RestController
@RequestMapping("/api/v1/notes")
public class NoteController {

    /** 노트별 향수 한 페이지입니다. 향수 검색과 같은 값을 씁니다. */
    private static final int DEFAULT_PAGE_SIZE = 20;

    private final NoteService noteService;

    public NoteController(NoteService noteService) {
        this.noteService = noteService;
    }

    /**
     * 노트 전체입니다. 페이지가 없습니다.
     *
     * <p>화면이 대분류로 묶어 구역을 나눠 그리므로 전부가 있어야 합니다. 246개이고 향수처럼
     * 늘어나는 값이 아닙니다.
     *
     * <p><b>묶는 일은 화면이 합니다.</b> 목록이 이미 대분류 순으로, 그 안에서 인기 순위대로
     * 나가므로 이어서 끊으면 됩니다. 서버가 나눠 보내면 빈 대분류를 어떻게 다룰지가 응답 모양에
     * 얽힙니다.
     */
    @Operation(summary = "노트 목록", description = "활성 노트 전체를 대분류·인기 순으로 돌려줍니다.")
    @ApiResponse(responseCode = "200", description = "조회 성공")
    @GetMapping
    public NotesResponse getNotes() {
        return noteService.findAll();
    }

    /** 노트 하나입니다. 이름·대분류·이미지·인기 순위가 나갑니다. */
    @Operation(summary = "노트 상세",
            description = "노트 하나의 이름 · 대분류 · 이미지 · 설명을 돌려줍니다. 설명은"
                    + " 요청 언어(Accept-Language: ko | en)를 따르고, 영어 설명이 없는 노트는"
                    + " 한국어 설명으로 되돌아갑니다. 설명은"
                    + " 채워지는 대로 들어오므로 비어 있을 수 있습니다. 목록에는 설명이"
                    + " 나가지 않습니다 — 활성 노트 전체를 돌려주는 응답이라 무거워집니다.")
    @ApiResponse(responseCode = "200", description = "조회 성공")
    @ApiResponse(responseCode = "404", description = "노트 없음")
    @GetMapping("/{noteId}")
    public NoteDetailResponse getNote(@PathVariable Long noteId) {
        return noteService.findById(noteId);
    }

    /**
     * 그 노트가 들어간 향수입니다. <b>페이지가 있습니다.</b>
     *
     * <p>노트 목록과 다른 점입니다 — 인기 노트 하나에 향수가 수만 개 달립니다(머스크 49,571개).
     *
     * <p>응답이 향수 검색과 같은 모양입니다. 화면이 같은 카드를 그리므로 다른 모양을 둘 이유가
     * 없습니다.
     *
     * <p>없는 노트는 404 입니다. 빈 목록으로 답하면 화면이 "향수가 없는 노트" 와 "잘못된 번호" 를
     * 구분할 수 없습니다.
     */
    @Operation(summary = "노트별 향수 목록",
            description = "그 노트가 들어간 활성 향수를 페이지로 돌려줍니다.")
    @ApiResponse(responseCode = "200", description = "조회 성공")
    @ApiResponse(responseCode = "404", description = "노트 없음")
    @GetMapping("/{noteId}/perfumes")
    public PerfumeSearchResponse getNotePerfumes(
            @PathVariable Long noteId,
            @Parameter(description = "0부터 시작하는 페이지 번호와 크기")
            @PageableDefault(size = DEFAULT_PAGE_SIZE) Pageable pageable
    ) {
        return noteService.findPerfumes(noteId, pageable);
    }
}
