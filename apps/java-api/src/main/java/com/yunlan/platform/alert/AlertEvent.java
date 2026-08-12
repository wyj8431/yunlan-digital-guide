package com.yunlan.platform.alert;

import java.time.Instant;

public record AlertEvent(
        String deviceId,
        String alertType,
        String level,
        String message,
        Instant occurredAt
) {
}
