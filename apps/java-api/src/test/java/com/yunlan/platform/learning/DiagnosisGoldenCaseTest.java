package com.yunlan.platform.learning;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;

class DiagnosisGoldenCaseTest {
    private final DiagnosisValidator validator = new DiagnosisValidator();
    private final MockDiagnosisProvider provider = new MockDiagnosisProvider();

    @Test
    void mockDiagnosisMatchesTheControlledCatalogForGoldenCases() {
        var cases = List.of(
                new Question(UUID.randomUUID(), "2x + 3 = 11", "{\"A\":\"3\",\"B\":\"4\"}", "B", "x = 4", "equation-one-variable", "easy"),
                new Question(UUID.randomUUID(), "x - 2 = 6", "{\"A\":\"4\",\"B\":\"8\"}", "B", "x = 8", "equation-transpose", "easy"),
                new Question(UUID.randomUUID(), "3x = 18", "{\"A\":\"6\",\"B\":\"9\"}", "A", "x = 6", "equation-coefficients", "easy"),
                new Question(UUID.randomUUID(), "4(x + 2) = 20", "{\"A\":\"3\",\"B\":\"5\"}", "A", "x = 3", "equation-simplify", "medium"),
                new Question(UUID.randomUUID(), "5x - 4 = 2x + 11", "{\"A\":\"3\",\"B\":\"5\"}", "B", "x = 5", "equation-transpose", "medium"),
                new Question(UUID.randomUUID(), "x / 3 + 2 = 6", "{\"A\":\"8\",\"B\":\"12\"}", "B", "x = 12", "equation-fractions", "medium"),
                new Question(UUID.randomUUID(), "(2x - 1) / 3 = 5", "{\"A\":\"8\",\"B\":\"9\"}", "A", "x = 8", "equation-fractions", "medium"),
                new Question(UUID.randomUUID(), "2(x - 3) + 4 = 10", "{\"A\":\"5\",\"B\":\"6\"}", "B", "x = 6", "equation-simplify", "medium"),
                new Question(UUID.randomUUID(), "Check x = 4 in 2x + 3 = 11", "{\"A\":\"yes\",\"B\":\"no\"}", "A", "8 + 3 = 11", "equation-check", "easy"),
                new Question(UUID.randomUUID(), "7 - 2x = 1", "{\"A\":\"3\",\"B\":\"4\"}", "A", "x = 3", "equation-coefficients", "medium")
        );

        assertEquals(10, cases.size());

        for (var question : cases) {
            var attempt = new Attempt(question.getId(), UUID.randomUUID(), "A", "I moved the constant first.", false);
            var candidate = provider.generate(question, attempt);

            assertDoesNotThrow(() -> validator.validate(candidate));
            assertEquals(question.getKnowledgePointId(), candidate.knowledgePointId());
            assertEquals(7, candidate.plan().size());
            assertEquals(List.of(1, 2, 3, 4, 5, 6, 7), candidate.plan().stream().map(DiagnosisCandidate.PlanDay::day).toList());
        }
    }
}
