package com.yunlan.platform.learning;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.util.UUID;

@Entity
@Table(name = "learning_questions")
public class Question {
    @Id
    private UUID id;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String stem;

    @Column(name = "options_json", nullable = false, columnDefinition = "TEXT")
    private String optionsJson;

    @Column(name = "correct_answer", nullable = false, length = 8)
    private String correctAnswer;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String solution;

    @Column(name = "knowledge_point_id", nullable = false, length = 80)
    private String knowledgePointId;

    @Column(nullable = false, length = 32)
    private String difficulty;

    protected Question() {
    }

    public Question(
            UUID id,
            String stem,
            String optionsJson,
            String correctAnswer,
            String solution,
            String knowledgePointId,
            String difficulty
    ) {
        this.id = id;
        this.stem = stem;
        this.optionsJson = optionsJson;
        this.correctAnswer = correctAnswer;
        this.solution = solution;
        this.knowledgePointId = knowledgePointId;
        this.difficulty = difficulty;
    }

    public UUID getId() {
        return id;
    }

    public String getStem() {
        return stem;
    }

    public String getOptionsJson() {
        return optionsJson;
    }

    public String getCorrectAnswer() {
        return correctAnswer;
    }

    public String getSolution() {
        return solution;
    }

    public String getKnowledgePointId() {
        return knowledgePointId;
    }

    public String getDifficulty() {
        return difficulty;
    }
}
