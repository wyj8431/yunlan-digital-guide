package com.yunlan.platform.learning;

import java.util.List;

public record DiagnosisCandidate(
        String knowledgePointId,
        String errorTypeId,
        String evidence,
        List<PlanDay> plan
) {
    public record PlanDay(int day, String task, String resourceId) {
    }
}
