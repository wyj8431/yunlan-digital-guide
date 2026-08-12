package com.yunlan.platform.alert;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface AlertGroupRepository extends JpaRepository<AlertGroup, UUID> {
    @Modifying
    @Query(value = """
            INSERT INTO alert_groups
                (id, device_id, alert_type, bucket_start, level, message, repeat_count, first_seen_at, last_seen_at)
            VALUES
                (:id, :deviceId, :alertType, :bucketStart, :level, :message, 1, :occurredAt, :occurredAt)
            ON CONFLICT (device_id, alert_type, bucket_start)
            DO UPDATE SET
                level = CASE
                    WHEN alert_groups.level = 'CRITICAL' OR EXCLUDED.level = 'CRITICAL' THEN 'CRITICAL'
                    WHEN alert_groups.level = 'WARNING' OR EXCLUDED.level = 'WARNING' THEN 'WARNING'
                    ELSE 'INFO'
                END,
                message = EXCLUDED.message,
                repeat_count = alert_groups.repeat_count + 1,
                first_seen_at = LEAST(alert_groups.first_seen_at, EXCLUDED.first_seen_at),
                last_seen_at = GREATEST(alert_groups.last_seen_at, EXCLUDED.last_seen_at)
            """, nativeQuery = true)
    int upsert(
            @Param("id") UUID id,
            @Param("deviceId") String deviceId,
            @Param("alertType") String alertType,
            @Param("bucketStart") Instant bucketStart,
            @Param("level") String level,
            @Param("message") String message,
            @Param("occurredAt") Instant occurredAt
    );

    List<AlertGroup> findAllByOrderByLastSeenAtDesc();

    Optional<AlertGroup> findByDeviceIdAndAlertTypeAndBucketStart(
            String deviceId,
            String alertType,
            Instant bucketStart
    );
}
