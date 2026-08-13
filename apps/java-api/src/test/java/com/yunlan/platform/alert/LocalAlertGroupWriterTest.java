package com.yunlan.platform.alert;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.Executors;

import static org.junit.jupiter.api.Assertions.assertEquals;

@SpringBootTest
@ActiveProfiles({"test", "local"})
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:h2:mem:local-alert-writer;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
        "app.dev-seed-enabled=false"
})
class LocalAlertGroupWriterTest {
    @Autowired
    private AlertProcessor processor;

    @Autowired
    private AlertGroupRepository groups;

    @Test
    void commitsConcurrentEventsForTheSameLocalGroupBeforeReleasingTheWriterLock() throws Exception {
        var deviceId = "local-concurrency-test-" + UUID.randomUUID();
        var bucket = Instant.parse("2026-08-10T01:05:00Z");
        var occurredAt = Instant.parse("2026-08-10T01:07:42Z");
        try (var executor = Executors.newFixedThreadPool(8)) {
            var futures = executor.invokeAll(java.util.stream.IntStream.range(0, 64)
                    .mapToObj(index -> (java.util.concurrent.Callable<Void>) () -> {
                        processor.process(new AlertEvent(
                                deviceId,
                                "temperature",
                                index % 2 == 0 ? "WARNING" : "CRITICAL",
                                "event-" + index,
                                occurredAt
                        ), bucket);
                        return null;
                    })
                    .toList());
            for (var future : futures) {
                future.get();
            }
        }

        List<AlertGroup> matches = groups.findAllByOrderByLastSeenAtDesc().stream()
                .filter(group -> group.getDeviceId().equals(deviceId))
                .toList();
        assertEquals(1, matches.size());
        assertEquals(64, matches.getFirst().getRepeatCount());
        assertEquals("CRITICAL", matches.getFirst().getLevel());
    }

    @Test
    void keepsEventsInAdjacentFiveMinuteUtcBucketsSeparate() {
        var deviceId = "cross-bucket-test-" + UUID.randomUUID();
        processor.process(
                new AlertEvent(deviceId, "temperature", "WARNING", "before boundary", Instant.parse("2026-08-10T01:04:59Z")),
                Instant.parse("2026-08-10T01:00:00Z")
        );
        processor.process(
                new AlertEvent(deviceId, "temperature", "WARNING", "after boundary", Instant.parse("2026-08-10T01:05:00Z")),
                Instant.parse("2026-08-10T01:05:00Z")
        );

        var buckets = groups.findAllByOrderByLastSeenAtDesc().stream()
                .filter(group -> group.getDeviceId().equals(deviceId))
                .map(AlertGroup::getBucketStart)
                .sorted()
                .toList();

        assertEquals(List.of(Instant.parse("2026-08-10T01:00:00Z"), Instant.parse("2026-08-10T01:05:00Z")), buckets);
    }
}
