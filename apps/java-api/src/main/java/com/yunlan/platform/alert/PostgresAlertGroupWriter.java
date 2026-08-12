package com.yunlan.platform.alert;

import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

@Component
@Profile("!local")
public class PostgresAlertGroupWriter implements AlertGroupWriter {
    private final AlertGroupRepository groups;

    public PostgresAlertGroupWriter(AlertGroupRepository groups) {
        this.groups = groups;
    }

    @Override
    @Transactional
    public void upsert(AlertEvent event, Instant bucketStart) {
        groups.upsert(
                UUID.randomUUID(),
                event.deviceId(),
                event.alertType(),
                bucketStart,
                event.level(),
                event.message(),
                event.occurredAt()
        );
    }
}
