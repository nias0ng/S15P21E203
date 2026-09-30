package com.hyanghae.backend.perfume.service;

import com.hyanghae.backend.global.exception.BusinessException;
import com.hyanghae.backend.global.i18n.Language;
import com.hyanghae.backend.perfume.dto.response.NoteDetailResponse;
import com.hyanghae.backend.perfume.dto.response.NoteSummaryResponse;
import com.hyanghae.backend.perfume.dto.response.NotesResponse;
import com.hyanghae.backend.perfume.dto.response.PerfumeSearchResponse;
import com.hyanghae.backend.perfume.dto.response.PerfumeSummaryResponse;
import com.hyanghae.backend.perfume.exception.PerfumeErrorCode;
import com.hyanghae.backend.perfume.repository.NoteDetailRow;
import com.hyanghae.backend.perfume.repository.NoteRepository;
import com.hyanghae.backend.perfume.repository.PerfumeImageRepository;
import com.hyanghae.backend.perfume.repository.PerfumeImageUrl;
import com.hyanghae.backend.perfume.repository.PerfumeNoteRepository;
import com.hyanghae.backend.perfume.repository.PerfumeScentFamilyRepository;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 노트 목록·상세와 노트별 향수를 읽습니다.
 *
 * <p>로그인이 필요 없습니다. 노트 화면은 누구나 볼 수 있어야 합니다.
 *
 * <p>내려간 노트와 비활성 향수는 뺍니다. 향수 검색과 같은 기준입니다.
 */
@Service
public class NoteService {

    private final NoteRepository noteRepository;
    private final PerfumeNoteRepository perfumeNoteRepository;
    private final PerfumeImageRepository perfumeImageRepository;
    private final PerfumeScentFamilyRepository perfumeScentFamilyRepository;

    public NoteService(
            NoteRepository noteRepository,
            PerfumeNoteRepository perfumeNoteRepository,
            PerfumeImageRepository perfumeImageRepository,
            PerfumeScentFamilyRepository perfumeScentFamilyRepository) {
        this.noteRepository = noteRepository;
        this.perfumeNoteRepository = perfumeNoteRepository;
        this.perfumeImageRepository = perfumeImageRepository;
        this.perfumeScentFamilyRepository = perfumeScentFamilyRepository;
    }

    /**
     * 노트 전부입니다. 페이지가 없습니다.
     *
     * <p>대분류로 묶고 그 안에서 인기 순위대로 나갑니다. 묶는 일은 화면이 합니다 — 순서가 이미
     * 그렇게 나가므로 이어서 끊으면 됩니다.
     */
    @Transactional(readOnly = true)
    public NotesResponse findAll() {
        return new NotesResponse(noteRepository.findAllActive());
    }

    /**
     * 노트 하나입니다. 내려갔거나 없는 노트는 404 입니다.
     *
     * <p>설명은 요청 언어를 따릅니다. 영어 요청이면 영어 설명이고, 영어 설명이 비어 있으면 한국어
     * 설명으로 되돌아갑니다. 한국어 요청은 언제나 한국어 설명입니다.
     */
    @Transactional(readOnly = true)
    public NoteDetailResponse findById(Long noteId) {
        NoteDetailRow note = noteRepository.findActiveById(noteId)
                .orElseThrow(() -> new BusinessException(PerfumeErrorCode.PERFUME_NOTE_NOT_FOUND));
        return new NoteDetailResponse(
                note.noteId(),
                note.name(),
                note.nameKo(),
                note.accordFamily(),
                note.imageUrl(),
                note.popularityRank(),
                describe(note, Language.current()));
    }

    /** 요청 언어의 설명입니다. 영어 설명이 없거나 공백뿐이면 한국어 설명을 씁니다. */
    private static String describe(NoteDetailRow note, Language language) {
        String english = note.descriptionEn();
        if (language.isEnglish() && english != null && !english.isBlank()) {
            return english;
        }
        return note.description();
    }

    /**
     * 그 노트가 들어간 향수입니다.
     *
     * <p>없는 노트는 404 입니다. 빈 목록으로 답하면 화면이 "향수가 없는 노트" 와 "잘못된 번호" 를
     * 구분할 수 없습니다.
     *
     * <p>대표 이미지와 향 계열은 향수 검색과 같은 방식으로 나중에 채웁니다. 한 쿼리로 묶으면
     * 이미지가 여러 장인 향수에서 행이 중복되고, 향 계열은 다른 도메인의 표에 있습니다.
     */
    @Transactional(readOnly = true)
    public PerfumeSearchResponse findPerfumes(Long noteId, Pageable pageable) {
        if (!noteRepository.existsByIdAndActiveTrue(noteId)) {
            throw new BusinessException(PerfumeErrorCode.PERFUME_NOTE_NOT_FOUND);
        }

        Page<PerfumeSummaryResponse> found =
                perfumeNoteRepository.findPerfumePageByNoteId(noteId, pageable);
        if (found.isEmpty()) {
            return PerfumeSearchResponse.from(found);
        }

        List<Long> perfumeIds = found.getContent().stream()
                .map(PerfumeSummaryResponse::perfumeId)
                .toList();
        Map<Long, String> images = loadThumbnails(perfumeIds);
        Map<Long, String> scentFamilies = perfumeScentFamilyRepository.findByPerfumeIds(perfumeIds);

        return PerfumeSearchResponse.from(found.map(perfume -> perfume.with(
                images.get(perfume.perfumeId()),
                scentFamilies.get(perfume.perfumeId())
        )));
    }

    /**
     * 향수마다 대표 이미지 한 장을 고릅니다.
     *
     * <p>저장소가 순서대로 주므로 먼저 온 것을 씁니다. {@code putIfAbsent} 가 그 일을 합니다.
     */
    private Map<Long, String> loadThumbnails(List<Long> perfumeIds) {
        Map<Long, String> thumbnails = new HashMap<>();
        for (PerfumeImageUrl candidate : perfumeImageRepository.findOrderedByPerfumeIds(perfumeIds)) {
            thumbnails.putIfAbsent(candidate.perfumeId(), candidate.imageUrl());
        }
        return thumbnails;
    }
}
