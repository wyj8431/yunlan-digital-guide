package com.yunlan.platform.learning;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.UUID;

public final class LearningDtos {
    private LearningDtos() {
    }

    public record QuestionResponse(
            UUID id,
            String stem,
            String optionsJson,
            String knowledgePointId,
            String difficulty
    ) {
        static QuestionResponse from(Question question) {
            return new QuestionResponse(
                    question.getId(),
                    question.getStem(),
                    question.getOptionsJson(),
                    question.getKnowledgePointId(),
                    question.getDifficulty()
            );
        }
    }

    public record SubmitAttemptRequest(
            @NotNull UUID questionId,
            @NotBlank @Size(max = 8) String selectedAnswer,
            @Size(max = 5000) String reasoning
    ) {
    }

    public record ReviewRequest(
            @NotNull ReviewStatus status,
            @Size(max = 10000) String candidateJson
    ) {
        public ReviewRequest(ReviewStatus status) {
            this(status, null);
        }
    }

    public record AttemptResponse(
            UUID id,
            UUID questionId,
            UUID learnerId,
            boolean correct,
            String selectedAnswer,
            String reasoning,
            String diagnosisStatus,
            ReviewStatus reviewStatus,
            String diagnosisJson,
            Instant createdAt
    ) {
    }
}
