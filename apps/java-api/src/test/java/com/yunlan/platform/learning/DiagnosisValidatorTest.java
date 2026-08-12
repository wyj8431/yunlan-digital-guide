package com.yunlan.platform.learning;

import org.junit.jupiter.api.Test;

import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

class DiagnosisValidatorTest {
    private final DiagnosisValidator validator = new DiagnosisValidator();

    @Test
    void acceptsAControlledSevenDayPlan() {
        var plan = java.util.stream.IntStream.rangeClosed(1, 7)
                .mapToObj(day -> new DiagnosisCandidate.PlanDay(
                        day,
                        "Review one worked example",
                        "resource-equation-basics"
                ))
                .toList();

        assertDoesNotThrow(() -> validator.validate(new DiagnosisCandidate(
                "equation-one-variable",
                "ARITHMETIC_ERROR",
                "The learner made an arithmetic mistake in the final step.",
                plan
        )));
    }

    @Test
    void rejectsUnknownResources() {
        var plan = java.util.stream.IntStream.rangeClosed(1, 7)
                .mapToObj(day -> new DiagnosisCandidate.PlanDay(day, "Practice", "not-in-catalog"))
                .toList();

        assertThrows(RuntimeException.class, () -> validator.validate(new DiagnosisCandidate(
                "equation-one-variable",
                "ARITHMETIC_ERROR",
                "Evidence",
                plan
        )));
    }

    @Test
    void rejectsPlansThatRepeatADay() {
        var plan = List.of(
                new DiagnosisCandidate.PlanDay(1, "Practice", "resource-equation-basics"),
                new DiagnosisCandidate.PlanDay(1, "Practice", "resource-equation-basics"),
                new DiagnosisCandidate.PlanDay(3, "Practice", "resource-equation-basics"),
                new DiagnosisCandidate.PlanDay(4, "Practice", "resource-equation-basics"),
                new DiagnosisCandidate.PlanDay(5, "Practice", "resource-equation-basics"),
                new DiagnosisCandidate.PlanDay(6, "Practice", "resource-equation-basics"),
                new DiagnosisCandidate.PlanDay(7, "Practice", "resource-equation-basics")
        );

        assertThrows(RuntimeException.class, () -> validator.validate(new DiagnosisCandidate(
                "equation-one-variable",
                "ARITHMETIC_ERROR",
                "Evidence",
                plan
        )));
    }

    @Test
    void rejectsCandidatesThatTryToReturnAStandardAnswer() throws Exception {
        var candidateJson = """
                {
                  "knowledgePointId": "equation-one-variable",
                  "errorTypeId": "ARITHMETIC_ERROR",
                  "evidence": "The learner divided before isolating the constant.",
                  "standardAnswer": "x = 4",
                  "plan": [
                    {"day": 1, "task": "Practice", "resourceId": "resource-equation-basics"},
                    {"day": 2, "task": "Practice", "resourceId": "resource-equation-basics"},
                    {"day": 3, "task": "Practice", "resourceId": "resource-equation-basics"},
                    {"day": 4, "task": "Practice", "resourceId": "resource-equation-basics"},
                    {"day": 5, "task": "Practice", "resourceId": "resource-equation-basics"},
                    {"day": 6, "task": "Practice", "resourceId": "resource-equation-basics"},
                    {"day": 7, "task": "Practice", "resourceId": "resource-equation-basics"}
                  ]
                }
                """;

        assertThrows(RuntimeException.class, () -> validator.validateJsonShape(
                new ObjectMapper().readTree(candidateJson)
        ));
    }

    @Test
    void rejectsCandidatesWithoutDiagnosisEvidence() {
        var plan = java.util.stream.IntStream.rangeClosed(1, 7)
                .mapToObj(day -> new DiagnosisCandidate.PlanDay(
                        day,
                        "Practice one worked example",
                        "resource-equation-basics"
                ))
                .toList();

        assertThrows(RuntimeException.class, () -> validator.validate(new DiagnosisCandidate(
                "equation-one-variable",
                "ARITHMETIC_ERROR",
                " ",
                plan
        )));
    }
}
