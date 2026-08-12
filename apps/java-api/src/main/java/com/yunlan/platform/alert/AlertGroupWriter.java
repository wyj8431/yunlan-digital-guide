package com.yunlan.platform.alert;

import java.time.Instant;

public interface AlertGroupWriter {
    void upsert(AlertEvent event, Instant bucketStart);
}
