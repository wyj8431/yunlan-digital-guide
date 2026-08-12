package com.yunlan.platform.alert;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.UUID;

public final class AlertDtos {
    private AlertDtos() {
    }

    public record SubmitRequest(
            @NotBlank @Size(max = 120) String deviceId,
            @NotBlank @Size(max = 120) String alertType,
            @NotBlank @Size(max = 32) String level,
            @NotBlank @Size(max = 5000) String message,
            @NotNull Instant occurredAt
    ) {
    }

    /**
     * Versioned intake shape for clients migrating from snake_case alert payloads.
     */
    public record CompatibilitySubmitRequest(
            @JsonProperty("device_id") @NotBlank @Size(max = 120) String deviceId,
            @JsonProperty("alert_type") @NotBlank @Size(max = 120) String alertType,
            @NotBlank @Size(max = 32) String severity,
            @NotBlank @Size(max = 5000) String message,
            @JsonProperty("occurred_at") @NotNull Instant occurredAt
    ) {
        SubmitRequest toSubmitRequest() {
            return new SubmitRequest(deviceId, alertType, normalizeSeverity(severity), message, occurredAt);
        }

        private static String normalizeSeverity(String severity) {
            return switch (severity.trim().toUpperCase()) {
                case "INFO" -> "INFO";
                case "WARN", "WARNING" -> "WARNING";
                case "CRITICAL" -> "CRITICAL";
                default -> severity;
            };
        }
    }

    public record AcceptedResponse(String status, int queuedCount) {
    }

    public record AlertGroupResponse(
            UUID id,
            String deviceId,
            String alertType,
            Instant bucketStart,
            String level,
            String message,
            int repeatCount,
            Instant firstSeenAt,
            Instant lastSeenAt
    ) {
        static AlertGroupResponse from(AlertGroup group) {
            return new AlertGroupResponse(
                    group.getId(),
                    group.getDeviceId(),
                    group.getAlertType(),
                    group.getBucketStart(),
                    group.getLevel(),
                    group.getMessage(),
                    group.getRepeatCount(),
                    group.getFirstSeenAt(),
                    group.getLastSeenAt()
            );
        }
    }
}
