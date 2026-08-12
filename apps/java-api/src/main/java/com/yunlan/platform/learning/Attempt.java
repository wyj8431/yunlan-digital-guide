package com.yunlan.platform.learning;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "learning_attempts")
public class Attempt {
    @Id
    private UUID id;

    @Column(name = "question_id", nullable = false)
    private UUID questionId;

    @Column(name = "learner_id", nullable = false)
    private UUID learnerId;

    @Column(name = "selected_answer", nullable = false, length = 8)
    private String selectedAnswer;

    @Column(columnDefinition = "TEXT")
    private String reasoning;

    @Column(nullable = false)
    private boolean correct;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected Attempt() {
    }

    public Attempt(UUID questionId, UUID learnerId, String selectedAnswer, String reasoning, boolean correct) {
        this.id = UUID.randomUUID();
        this.questionId = questionId;
        this.learnerId = learnerId;
        this.selectedAnswer = selectedAnswer;
        this.reasoning = reasoning;
        this.correct = correct;
        this.createdAt = Instant.now();
    }

    public UUID getId() {
        return id;
    }

    public UUID getQuestionId() {
        return questionId;
    }

    public UUID getLearnerId() {
        return learnerId;
    }

    public String getSelectedAnswer() {
        return selectedAnswer;
    }

    public String getReasoning() {
        return reasoning;
    }

    public boolean isCorrect() {
        return correct;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
