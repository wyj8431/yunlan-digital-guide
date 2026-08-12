package com.yunlan.platform.alert;

import com.yunlan.platform.common.api.ApiException;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

@Component
public class AlertQueue {
    private static final Logger LOGGER = LoggerFactory.getLogger(AlertQueue.class);

    private final AlertProcessor processor;
    private final ArrayBlockingQueue<AlertEvent> queue;
    private final int concurrency;
    private final int bucketMinutes;
    private final long shutdownTimeoutSeconds;
    private final AtomicBoolean accepting = new AtomicBoolean(false);
    private final List<Future<?>> workers = new ArrayList<>();
    private ExecutorService executor;

    public AlertQueue(
            AlertProcessor processor,
            @Value("${app.alerts.queue-size:100}") int queueSize,
            @Value("${app.alerts.concurrency:4}") int concurrency,
            @Value("${app.alerts.bucket-minutes:5}") int bucketMinutes,
            @Value("${app.alerts.shutdown-timeout-seconds:10}") long shutdownTimeoutSeconds
    ) {
        if (queueSize < 1 || concurrency < 1 || bucketMinutes < 1 || shutdownTimeoutSeconds < 1) {
            throw new IllegalArgumentException("Alert queue settings must be positive");
        }
        this.processor = processor;
        this.queue = new ArrayBlockingQueue<>(queueSize);
        this.concurrency = concurrency;
        this.bucketMinutes = bucketMinutes;
        this.shutdownTimeoutSeconds = shutdownTimeoutSeconds;
    }

    @PostConstruct
    public synchronized void start() {
        if (accepting.get()) {
            return;
        }
        executor = Executors.newFixedThreadPool(concurrency);
        accepting.set(true);
        for (var index = 0; index < concurrency; index++) {
            workers.add(executor.submit(this::consume));
        }
    }

    public synchronized void enqueue(AlertEvent event) {
        if (!accepting.get()) {
            throw new ApiException("SERVICE_SHUTTING_DOWN", HttpStatus.SERVICE_UNAVAILABLE, "Alert service is shutting down.");
        }
        if (!queue.offer(event)) {
            throw new ApiException("ALERT_QUEUE_FULL", HttpStatus.SERVICE_UNAVAILABLE, "Alert queue is full.");
        }
    }

    public int queuedCount() {
        return queue.size();
    }

    private void consume() {
        try {
            while (accepting.get() || !queue.isEmpty()) {
                var event = queue.poll(200, TimeUnit.MILLISECONDS);
                if (event == null) {
                    continue;
                }
                try {
                    processor.process(event, bucketStart(event.occurredAt()));
                } catch (Exception exception) {
                    LOGGER.error("Alert processing failed for device={} type={}", event.deviceId(), event.alertType(), exception);
                }
            }
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            LOGGER.warn("Alert consumer interrupted");
        }
    }

    Instant bucketStart(Instant occurredAt) {
        var bucketSeconds = Duration.ofMinutes(bucketMinutes).toSeconds();
        var bucketEpoch = Math.floorDiv(occurredAt.getEpochSecond(), bucketSeconds) * bucketSeconds;
        return Instant.ofEpochSecond(bucketEpoch);
    }

    @PreDestroy
    public synchronized void shutdown() {
        if (!accepting.compareAndSet(true, false)) {
            return;
        }
        var deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(shutdownTimeoutSeconds);
        for (var worker : workers) {
            var remaining = deadline - System.nanoTime();
            if (remaining <= 0) {
                break;
            }
            try {
                worker.get(remaining, TimeUnit.NANOSECONDS);
            } catch (Exception exception) {
                worker.cancel(true);
                LOGGER.warn("Alert consumer did not finish before shutdown timeout", exception);
            }
        }
        executor.shutdownNow();
    }
}
