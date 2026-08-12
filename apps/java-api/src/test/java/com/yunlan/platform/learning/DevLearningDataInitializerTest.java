package com.yunlan.platform.learning;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest
@ActiveProfiles({"test", "local"})
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:h2:mem:learning-seed;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
        "app.dev-seed-enabled=true"
})
class DevLearningDataInitializerTest {
    @Autowired
    private QuestionRepository questions;

    @Test
    void seedsTwelveManuallyLabeledEquationQuestions() {
        var seededQuestions = questions.findAll();

        assertEquals(12, seededQuestions.size());
        assertEquals(6, seededQuestions.stream()
                .map(Question::getKnowledgePointId)
                .distinct()
                .count());
        assertTrue(seededQuestions.stream()
                .allMatch(question -> question.getOptionsJson().contains("\"A\"")));
    }
}
