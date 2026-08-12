package com.yunlan.platform.alert;

import org.springframework.stereotype.Service;

import java.time.Instant;

@Service
public class AlertProcessor {
    private final AlertGroupWriter groupWriter;

    public AlertProcessor(AlertGroupWriter groupWriter) {
        this.groupWriter = groupWriter;
    }

    public void process(AlertEvent event, Instant bucketStart) {
        groupWriter.upsert(event, bucketStart);
    }
}
