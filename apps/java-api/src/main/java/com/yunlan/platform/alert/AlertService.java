package com.yunlan.platform.alert;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class AlertService {
    private final AlertQueue queue;
    private final AlertGroupRepository groups;

    public AlertService(AlertQueue queue, AlertGroupRepository groups) {
        this.queue = queue;
        this.groups = groups;
    }

    public AlertDtos.AcceptedResponse submit(AlertDtos.SubmitRequest request) {
        var event = new AlertEvent(
                request.deviceId().trim(),
                request.alertType().trim(),
                normalizeLevel(request.level()),
                request.message().trim(),
                request.occurredAt()
        );
        queue.enqueue(event);
        return new AlertDtos.AcceptedResponse("accepted", queue.queuedCount());
    }

    @Transactional(readOnly = true)
    public List<AlertDtos.AlertGroupResponse> list() {
        return groups.findAllByOrderByLastSeenAtDesc().stream()
                .map(AlertDtos.AlertGroupResponse::from)
                .toList();
    }

    private String normalizeLevel(String level) {
        var normalized = level.trim().toUpperCase();
        if (!normalized.equals("INFO") && !normalized.equals("WARNING") && !normalized.equals("CRITICAL")) {
            throw new com.yunlan.platform.common.api.ApiException(
                    "INVALID_ALERT_LEVEL",
                    org.springframework.http.HttpStatus.BAD_REQUEST,
                    "Alert level must be INFO, WARNING, or CRITICAL."
            );
        }
        return normalized;
    }
}
