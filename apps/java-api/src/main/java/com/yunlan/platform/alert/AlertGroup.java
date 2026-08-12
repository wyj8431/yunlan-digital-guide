package com.yunlan.platform.alert;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "alert_groups")
public class AlertGroup {
    @Id
    private UUID id;

    @Column(name = "device_id", nullable = false, length = 120)
    private String deviceId;

    @Column(name = "alert_type", nullable = false, length = 120)
    private String alertType;

    @Column(name = "bucket_start", nullable = false)
    private Instant bucketStart;

    @Column(nullable = false, length = 32)
    private String level;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String message;

    @Column(name = "repeat_count", nullable = false)
    private int repeatCount;

    @Column(name = "first_seen_at", nullable = false)
    private Instant firstSeenAt;

    @Column(name = "last_seen_at", nullable = false)
    private Instant lastSeenAt;

    protected AlertGroup() {
    }

    public AlertGroup(AlertEvent event, Instant bucketStart) {
        this.id = UUID.randomUUID();
        this.deviceId = event.deviceId();
        this.alertType = event.alertType();
        this.bucketStart = bucketStart;
        this.level = event.level();
        this.message = event.message();
        this.repeatCount = 0;
        this.firstSeenAt = event.occurredAt();
        this.lastSeenAt = event.occurredAt();
    }

    public void merge(AlertEvent event) {
        this.level = higherLevel(this.level, event.level());
        this.message = event.message();
        this.repeatCount++;
        if (event.occurredAt().isBefore(firstSeenAt)) {
            firstSeenAt = event.occurredAt();
        }
        if (event.occurredAt().isAfter(lastSeenAt)) {
            lastSeenAt = event.occurredAt();
        }
    }

    private String higherLevel(String current, String incoming) {
        if ("CRITICAL".equals(current) || "CRITICAL".equals(incoming)) {
            return "CRITICAL";
        }
        if ("WARNING".equals(current) || "WARNING".equals(incoming)) {
            return "WARNING";
        }
        return "INFO";
    }

    public UUID getId() {
        return id;
    }

    public String getDeviceId() {
        return deviceId;
    }

    public String getAlertType() {
        return alertType;
    }

    public Instant getBucketStart() {
        return bucketStart;
    }

    public String getLevel() {
        return level;
    }

    public String getMessage() {
        return message;
    }

    public int getRepeatCount() {
        return repeatCount;
    }

    public Instant getFirstSeenAt() {
        return firstSeenAt;
    }

    public Instant getLastSeenAt() {
        return lastSeenAt;
    }
}
