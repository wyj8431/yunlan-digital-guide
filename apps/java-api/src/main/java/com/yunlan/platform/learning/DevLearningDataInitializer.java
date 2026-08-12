package com.yunlan.platform.learning;

import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.List;
import java.util.UUID;

@Configuration
@ConditionalOnProperty(name = "app.dev-seed-enabled", havingValue = "true")
public class DevLearningDataInitializer {
    private static final List<Question> DEMO_QUESTIONS = List.of(
            question("20000000-0000-0000-0000-000000000001", "Solve 2x + 3 = 11. Which value is x?", "{\"A\":\"3\",\"B\":\"4\",\"C\":\"5\",\"D\":\"7\"}", "B", "Subtract 3 from both sides, then divide by 2: x = 4.", "equation-one-variable", "easy"),
            question("20000000-0000-0000-0000-000000000002", "Solve x - 7 = 5. Which value is x?", "{\"A\":\"-2\",\"B\":\"2\",\"C\":\"12\",\"D\":\"35\"}", "C", "Add 7 to both sides: x = 12.", "equation-transpose", "easy"),
            question("20000000-0000-0000-0000-000000000003", "Solve 3x = 18. Which value is x?", "{\"A\":\"6\",\"B\":\"9\",\"C\":\"15\",\"D\":\"21\"}", "A", "Divide both sides by 3: x = 6.", "equation-coefficients", "easy"),
            question("20000000-0000-0000-0000-000000000004", "Solve 4(x + 2) = 20. Which value is x?", "{\"A\":\"2\",\"B\":\"3\",\"C\":\"5\",\"D\":\"7\"}", "B", "Divide by 4, then subtract 2: x = 3.", "equation-simplify", "medium"),
            question("20000000-0000-0000-0000-000000000005", "Solve 5x - 4 = 2x + 11. Which value is x?", "{\"A\":\"3\",\"B\":\"5\",\"C\":\"7\",\"D\":\"15\"}", "B", "Move 2x left and -4 right: 3x = 15, so x = 5.", "equation-transpose", "medium"),
            question("20000000-0000-0000-0000-000000000006", "Solve x / 3 + 2 = 6. Which value is x?", "{\"A\":\"4\",\"B\":\"8\",\"C\":\"12\",\"D\":\"18\"}", "C", "Subtract 2, then multiply by 3: x = 12.", "equation-fractions", "medium"),
            question("20000000-0000-0000-0000-000000000007", "Solve (2x - 1) / 3 = 5. Which value is x?", "{\"A\":\"7\",\"B\":\"8\",\"C\":\"9\",\"D\":\"15\"}", "B", "Multiply by 3, add 1, then divide by 2: x = 8.", "equation-fractions", "medium"),
            question("20000000-0000-0000-0000-000000000008", "Solve 2(x - 3) + 4 = 10. Which value is x?", "{\"A\":\"4\",\"B\":\"5\",\"C\":\"6\",\"D\":\"8\"}", "C", "Expand and simplify: 2x - 2 = 10, so x = 6.", "equation-simplify", "medium"),
            question("20000000-0000-0000-0000-000000000009", "Which substitution checks x = 4 for 2x + 3 = 11?", "{\"A\":\"2(4) + 3 = 11\",\"B\":\"2 + 4(3) = 11\",\"C\":\"4 + 3 = 11\",\"D\":\"2(3) + 4 = 11\"}", "A", "Substitute 4 for x: 2(4) + 3 = 11.", "equation-check", "easy"),
            question("20000000-0000-0000-0000-000000000010", "Solve 7 - 2x = 1. Which value is x?", "{\"A\":\"-3\",\"B\":\"3\",\"C\":\"4\",\"D\":\"6\"}", "B", "Subtract 7: -2x = -6, then divide by -2: x = 3.", "equation-coefficients", "medium"),
            question("20000000-0000-0000-0000-000000000011", "Solve 0.5x + 1 = 4. Which value is x?", "{\"A\":\"1.5\",\"B\":\"3\",\"C\":\"6\",\"D\":\"8\"}", "C", "Subtract 1 and divide by 0.5: x = 6.", "equation-one-variable", "medium"),
            question("20000000-0000-0000-0000-000000000012", "Solve 3(x + 1) - x = 10. Which value is x?", "{\"A\":\"2\",\"B\":\"3\",\"C\":\"3.5\",\"D\":\"5\"}", "C", "Expand: 3x + 3 - x = 10. Then 2x = 7, so x = 3.5.", "equation-simplify", "hard")
    );

    @Bean
    CommandLineRunner seedLearningQuestions(QuestionRepository questions) {
        return args -> {
            var missingQuestions = DEMO_QUESTIONS.stream()
                    .filter(question -> !questions.existsById(question.getId()))
                    .toList();
            if (!missingQuestions.isEmpty()) {
                questions.saveAll(missingQuestions);
            }
        };
    }

    private static Question question(
            String id,
            String stem,
            String optionsJson,
            String correctAnswer,
            String solution,
            String knowledgePointId,
            String difficulty
    ) {
        return new Question(
                UUID.fromString(id),
                stem,
                optionsJson,
                correctAnswer,
                solution,
                knowledgePointId,
                difficulty
        );
    }
}
