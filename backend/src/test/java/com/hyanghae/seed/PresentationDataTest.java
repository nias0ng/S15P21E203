package com.hyanghae.seed;

import static org.assertj.core.api.Assertions.*;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class PresentationDataTest {
    @TempDir Path temp;

    @Test
    void rejectsDuplicateReviewerAndWrongCountsBeforeDatabaseAccess() throws Exception {
        Path source = Path.of("db/seed/presentation");
        Files.copy(source.resolve("manifest.json"), temp.resolve("manifest.json"));
        var lines = Files.readAllLines(source.resolve("reviews.tsv"));
        lines.add(lines.get(1));
        Files.write(temp.resolve("reviews.tsv"), lines);
        assertThatThrownBy(() -> PresentationData.load(temp)).hasMessageContaining("한 사람당 향수 후기 1개");
        lines.removeLast();
        lines.removeLast();
        Files.write(temp.resolve("reviews.tsv"), lines);
        assertThatThrownBy(() -> PresentationData.load(temp)).hasMessageContaining("후기 목표 수: candy");
    }

    @Test
    void refusesMissingEmptyOrPlainTextBackup() throws Exception {
        assertThatThrownBy(() -> PresentationSeed.validateBackup(temp.resolve("missing"))).hasMessageContaining("백업 파일");
        Path empty = Files.write(temp.resolve("empty"), new byte[0]);
        assertThatThrownBy(() -> PresentationSeed.validateBackup(empty)).hasMessageContaining("백업 파일");
        Path fake = Files.writeString(temp.resolve("plain"), "x".repeat(2048));
        assertThatThrownBy(() -> PresentationSeed.validateBackup(fake)).hasMessageContaining("백업 형식");
    }
}
