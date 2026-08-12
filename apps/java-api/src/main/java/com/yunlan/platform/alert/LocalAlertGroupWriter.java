package com.yunlan.platform.alert;

import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Instant;

@Component
@Profile("local")
public class LocalAlertGroupWriter implements AlertGroupWriter {
    private final AlertGroupRepository groups;
    private final TransactionTemplate transactions;

    public LocalAlertGroupWriter(
            AlertGroupRepository groups,
            PlatformTransactionManager transactionManager
    ) {
        this.groups = groups;
        this.transactions = new TransactionTemplate(transactionManager);
    }

    @Override
    public synchronized void upsert(AlertEvent event, Instant bucketStart) {
        // H2 development writes use one lock through commit. Releasing it before commit allows workers
        // to race on the unique aggregation key and silently lose events in the queue consumer.
        transactions.executeWithoutResult(ignored -> {
            var group = groups.findByDeviceIdAndAlertTypeAndBucketStart(
                    event.deviceId(),
                    event.alertType(),
                    bucketStart
            ).orElseGet(() -> new AlertGroup(event, bucketStart));
            group.merge(event);
            groups.saveAndFlush(group);
        });
    }
}
