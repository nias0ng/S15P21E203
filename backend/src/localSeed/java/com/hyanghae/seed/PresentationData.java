package com.hyanghae.seed;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;

/** 사람이 함께 검수할 수 있는 향수별 후기와 글·댓글 묶음. 임의 문장 조합은 하지 않습니다. */
final class PresentationData {
    record Perfume(String key, long externalId, String brand, String name, int reviewCount) {}
    record Collection(String key, int owner, String name, String description, List<String> perfumes) {}
    record Comment(int author, String content) {}
    record Post(int owner, String category, String collection, String title, String content,
                List<String> perfumes, List<Comment> comments) {}
    record Manifest(String version, List<Perfume> perfumes, List<String> nicknames,
                    List<Collection> collections, List<Post> posts) {}
    record Review(String perfume, int author, String experience, String season, String title, String content) {}

    final Manifest manifest;
    final List<Review> reviews;

    private PresentationData(Manifest manifest, List<Review> reviews) {
        this.manifest = manifest;
        this.reviews = List.copyOf(reviews);
        validate();
    }

    static PresentationData load(Path directory) throws Exception {
        Manifest manifest = new ObjectMapper().readValue(directory.resolve("manifest.json").toFile(), Manifest.class);
        List<String> lines = Files.readAllLines(directory.resolve("reviews.tsv"));
        require(!lines.isEmpty() && lines.getFirst().equals("perfume\tauthor\texperience\tseason\ttitle\tcontent"), "후기 TSV 헤더");
        List<Review> reviews = new ArrayList<>();
        for (String line : lines.subList(1, lines.size())) {
            if (line.isBlank()) continue;
            String[] cells = line.split("\t", -1);
            require(cells.length == 6, "후기 TSV 열 개수");
            reviews.add(new Review(cells[0], Integer.parseInt(cells[1]), cells[2], cells[3], cells[4], cells[5]));
        }
        return new PresentationData(manifest, reviews);
    }

    private void validate() {
        require(manifest.version() != null && !manifest.version().isBlank(), "데이터 버전");
        require(manifest.nicknames().size() == 32 && new HashSet<>(manifest.nicknames()).size() == 32, "배경 사용자 32명");
        Set<String> keys = new HashSet<>();
        Set<Long> identities = new HashSet<>();
        for (Perfume perfume : manifest.perfumes()) {
            require(keys.add(perfume.key()) && identities.add(perfume.externalId()), "중복 향수");
            require(!perfume.name().isBlank() && !perfume.brand().isBlank() && perfume.reviewCount() > 0, "향수 식별값");
        }
        Set<String> authors = new HashSet<>();
        Set<String> texts = new HashSet<>();
        for (Review review : reviews) {
            author(review.author());
            require(keys.contains(review.perfume()), "후기 대상 향수");
            require(authors.add(review.perfume() + "/" + review.author()), "한 사람당 향수 후기 1개");
            require(texts.add(review.content()), "중복 후기 본문");
            require(Set.of("OWNED", "WISH", "SAMPLE", "COUNTER").contains(review.experience()), "사용 경험");
            require(Set.of("SPRING", "SUMMER", "AUTUMN", "WINTER").contains(review.season()), "후기 계절");
            require(!review.title().isBlank() && review.title().length() <= 50, "후기 제목");
            require(review.content().length() >= 40 && review.content().length() <= 1000, "후기 본문 길이");
        }
        for (Perfume perfume : manifest.perfumes()) {
            require(reviews.stream().filter(r -> r.perfume().equals(perfume.key())).count() == perfume.reviewCount(),
                    "후기 목표 수: " + perfume.key());
        }
        Map<String, Collection> collections = new HashMap<>();
        for (Collection collection : manifest.collections()) {
            author(collection.owner());
            require(collections.put(collection.key(), collection) == null, "중복 컬렉션");
            require(!collection.name().isBlank() && collection.name().length() <= 255
                    && collection.description().length() <= 500, "컬렉션 문구");
            perfumeKeys(keys, collection.perfumes());
        }
        for (Post post : manifest.posts()) {
            author(post.owner());
            require(Set.of("CHAT", "RECOMMEND", "COLLECTION").contains(post.category()), "글 분류");
            require(!post.title().isBlank() && post.title().length() <= 50 && !post.content().isBlank(), "글 제목/본문");
            perfumeKeys(keys, post.perfumes());
            if (post.collection() != null) {
                Collection collection = collections.get(post.collection());
                require(collection != null && collection.owner() == post.owner()
                        && collection.perfumes().equals(post.perfumes()) && post.category().equals("COLLECTION"), "컬렉션 공유 스냅샷");
            } else {
                require(!post.category().equals("COLLECTION"), "공유 글의 컬렉션 누락");
            }
            for (Comment comment : post.comments()) {
                author(comment.author());
                require(!comment.content().isBlank(), "빈 댓글");
            }
        }
    }

    private static void perfumeKeys(Set<String> keys, List<String> selected) {
        require(!selected.isEmpty() && keys.containsAll(selected)
                && new HashSet<>(selected).size() == selected.size(), "연결 향수 목록");
    }

    private static void author(int value) { require(value >= 1 && value <= 32, "배경 작성자 범위"); }
    static void require(boolean condition, String description) {
        if (!condition) throw new IllegalStateException("SEED 검증 실패: " + description);
    }
}
