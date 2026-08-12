package com.yunlan.platform.learning;

import com.yunlan.platform.common.api.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

import java.util.HashSet;
import java.util.Set;

@Component
public class DiagnosisValidator {
    public void validate(DiagnosisCandidate candidate) {
        if (candidate == null || candidate.plan() == null || candidate.plan().size() != 7) {
            throw invalid("Diagnosis must contain exactly seven plan days.");
        }
        if (!DiagnosisCatalog.hasKnowledgePoint(candidate.knowledgePointId())) {
            throw invalid("Unknown knowledge point.");
        }
        if (!DiagnosisCatalog.hasErrorType(candidate.errorTypeId())) {
            throw invalid("Unknown error type.");
        }
        if (candidate.evidence() == null || candidate.evidence().isBlank()) {
            throw invalid("Diagnosis evidence is required.");
        }
        var scheduledDays = new HashSet<Integer>();
        for (var day : candidate.plan()) {
            if (day.day() < 1 || day.day() > 7 || day.task() == null || day.task().isBlank()) {
                throw invalid("Learning plan contains an invalid day.");
            }
            if (!scheduledDays.add(day.day())) {
                throw invalid("Learning plan must contain each day exactly once.");
            }
            if (!DiagnosisCatalog.hasResource(day.resourceId())) {
                throw invalid("Learning plan contains an unknown resource.");
            }
        }
    }

    public void validateJsonShape(com.fasterxml.jackson.databind.JsonNode root) {
        if (root == null || !root.isObject()) {
            throw invalid("Diagnosis must be a JSON object.");
        }
        var expected = Set.of("knowledgePointId", "errorTypeId", "evidence", "plan");
        var actual = new HashSet<String>();
        root.fieldNames().forEachRemaining(actual::add);
        if (!actual.equals(expected)) {
            throw invalid("Diagnosis contains undefined or missing fields.");
        }
        if (!root.path("plan").isArray()) {
            throw invalid("Learning plan must be an array.");
        }
        for (var day : root.path("plan")) {
            var dayFields = new HashSet<String>();
            day.fieldNames().forEachRemaining(dayFields::add);
            if (!dayFields.equals(Set.of("day", "task", "resourceId"))) {
                throw invalid("Learning plan contains undefined or missing fields.");
            }
        }
    }

    private ApiException invalid(String message) {
        return new ApiException("INVALID_DIAGNOSIS", HttpStatus.UNPROCESSABLE_ENTITY, message);
    }
}
