package com.yunlan.platform.alert;

import com.yunlan.platform.common.api.ApiException;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.lang.reflect.Modifier;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;

class AlertQueueTest {
    @Test
    void rejectsEventsWhenTheBoundedQueueIsFull() {
        var processor = mock(AlertProcessor.class);
        var processingStarted = new CountDownLatch(1);
        var releaseProcessing = new CountDownLatch(1);
        doAnswer(invocation -> {
            processingStarted.countDown();
            releaseProcessing.await(2, TimeUnit.SECONDS);
            return null;
        }).when(processor).process(any(), any());
        var queue = new AlertQueue(processor, 1, 1, 5, 1);
        var event = new AlertEvent("device-1", "temperature", "WARNING", "hot", Instant.now());

        queue.start();
        queue.enqueue(event);
        try {
            processingStarted.await(2, TimeUnit.SECONDS);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new AssertionError(exception);
        }
        queue.enqueue(event);
        var exception = assertThrows(ApiException.class, () -> queue.enqueue(event));

        assertEquals("ALERT_QUEUE_FULL", exception.code());
        releaseProcessing.countDown();
        queue.shutdown();
    }

    @Test
    void rejectsEventsAfterShutdown() {
        var queue = new AlertQueue(mock(AlertProcessor.class), 2, 1, 5, 1);

        queue.start();
        queue.shutdown();

        var exception = assertThrows(ApiException.class, () -> queue.enqueue(
                new AlertEvent("device-1", "temperature", "INFO", "ok", Instant.now())
        ));

        assertEquals("SERVICE_SHUTTING_DOWN", exception.code());
    }

    @Test
    void serializesEnqueueWithShutdownLifecycleTransition() throws Exception {
        assertTrue(Modifier.isSynchronized(AlertQueue.class
                .getDeclaredMethod("enqueue", AlertEvent.class)
                .getModifiers()));
        assertTrue(Modifier.isSynchronized(AlertQueue.class
                .getDeclaredMethod("shutdown")
                .getModifiers()));
    }

    @Test
    void usesTheConfiguredFixedConsumerConcurrency() throws Exception {
        var processingStarted = new CountDownLatch(4);
        var releaseProcessing = new CountDownLatch(1);
        var active = new AtomicInteger();
        var maximum = new AtomicInteger();
        var processor = mock(AlertProcessor.class);
        doAnswer(invocation -> {
            var current = active.incrementAndGet();
            maximum.accumulateAndGet(current, Math::max);
            processingStarted.countDown();
            releaseProcessing.await(2, TimeUnit.SECONDS);
            active.decrementAndGet();
            return null;
        }).when(processor).process(any(), any());
        var queue = new AlertQueue(processor, 8, 4, 5, 1);

        queue.start();
        for (var index = 0; index < 4; index++) {
            queue.enqueue(new AlertEvent("device-" + index, "temperature", "WARNING", "hot", Instant.now()));
        }

        try {
            org.junit.jupiter.api.Assertions.assertTrue(processingStarted.await(2, TimeUnit.SECONDS));
            assertEquals(4, maximum.get());
        } finally {
            releaseProcessing.countDown();
            queue.shutdown();
        }
    }

    @Test
    void continuesProcessingAfterAnAsyncWriterFailure() throws Exception {
        var attempts = new AtomicInteger();
        var secondEventProcessed = new CountDownLatch(1);
        var processor = mock(AlertProcessor.class);
        doAnswer(invocation -> {
            if (attempts.incrementAndGet() == 1) {
                throw new IllegalStateException("Simulated writer failure");
            }
            secondEventProcessed.countDown();
            return null;
        }).when(processor).process(any(), any());
        var queue = new AlertQueue(processor, 2, 1, 5, 1);

        queue.start();
        try {
            queue.enqueue(new AlertEvent("failure-device", "temperature", "WARNING", "first", Instant.now()));
            queue.enqueue(new AlertEvent("recovery-device", "temperature", "WARNING", "second", Instant.now()));

            assertTrue(secondEventProcessed.await(2, TimeUnit.SECONDS));
            assertEquals(2, attempts.get());
        } finally {
            queue.shutdown();
        }
    }

    @Test
    void drainsAcceptedEventsBeforeCompletingShutdown() throws Exception {
        var processed = new CountDownLatch(2);
        var processor = mock(AlertProcessor.class);
        doAnswer(invocation -> {
            processed.countDown();
            return null;
        }).when(processor).process(any(), any());
        var queue = new AlertQueue(processor, 4, 1, 5, 2);

        queue.start();
        queue.enqueue(new AlertEvent("drain-device-1", "temperature", "WARNING", "first", Instant.now()));
        queue.enqueue(new AlertEvent("drain-device-2", "temperature", "WARNING", "second", Instant.now()));
        queue.shutdown();

        assertTrue(processed.await(100, TimeUnit.MILLISECONDS));
        assertEquals(0, queue.queuedCount());
        queue.shutdown();
    }

    @Test
    void waitsForAnInFlightAcceptedEventBeforeCompletingShutdown() throws Exception {
        var processingStarted = new CountDownLatch(1);
        var releaseProcessing = new CountDownLatch(1);
        var processingCompleted = new CountDownLatch(1);
        var shutdownCompleted = new CountDownLatch(1);
        var processor = mock(AlertProcessor.class);
        doAnswer(invocation -> {
            processingStarted.countDown();
            if (!releaseProcessing.await(2, TimeUnit.SECONDS)) {
                throw new AssertionError("Test did not release the in-flight alert.");
            }
            processingCompleted.countDown();
            return null;
        }).when(processor).process(any(), any());
        var queue = new AlertQueue(processor, 2, 1, 5, 2);

        queue.start();
        queue.enqueue(new AlertEvent("in-flight-device", "temperature", "WARNING", "active", Instant.now()));
        assertTrue(processingStarted.await(1, TimeUnit.SECONDS));

        var shutdownThread = new Thread(() -> {
            queue.shutdown();
            shutdownCompleted.countDown();
        });
        shutdownThread.start();
        assertTrue(!shutdownCompleted.await(100, TimeUnit.MILLISECONDS));

        releaseProcessing.countDown();
        assertTrue(processingCompleted.await(1, TimeUnit.SECONDS));
        assertTrue(shutdownCompleted.await(1, TimeUnit.SECONDS));
        shutdownThread.join(1000);
    }

    @Test
    void alignsEventsToFiveMinuteBuckets() {
        var queue = new AlertQueue(mock(AlertProcessor.class), 2, 1, 5, 1);
        var occurredAt = Instant.parse("2026-08-10T01:07:42Z");

        assertEquals(Instant.parse("2026-08-10T01:05:00Z"), queue.bucketStart(occurredAt));
    }

    @Test
    void floorsPreEpochEventsIntoThePreviousUtcBucket() {
        var queue = new AlertQueue(mock(AlertProcessor.class), 2, 1, 5, 1);
        var occurredAt = Instant.parse("1969-12-31T23:59:59Z");

        assertEquals(Instant.parse("1969-12-31T23:55:00Z"), queue.bucketStart(occurredAt));
    }
}
