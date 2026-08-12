package com.yunlan.platform.learning;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "learning_diagnoses")
public class Diagnosis {
    @Id
    private UUID id;

    @Column(name = "attempt_id", nullable = false, unique = true)
    private UUID attemptId;

    @Column(name = "candidate_json", nullable = false, columnDefinition = "TEXT")
    private String candidateJson;

    @Column(name = "validation_status", nullable = false, length = 32)
    private String validationStatus;

    @Enumerated(EnumType.STRING)
    @Column(name = "review_status", nullable = false, length = 32)
    private ReviewStatus reviewStatus;

    @Column(name = "reviewer_id")
    private UUID reviewerId;

    @Column(name = "reviewed_at")
    private Instant reviewedAt;

    protected Diagnosis() {
    }

    public Diagnosis(UUID attemptId, String candidateJson) {
        this(attemptId, candidateJson, "VALID");
    }

    public Diagnosis(UUID attemptId, String candidateJson, String validationStatus) {
        this.id = UUID.randomUUID();
        this.attemptId = attemptId;
        this.candidateJson = candidateJson;
        this.validationStatus = validationStatus;
        this.reviewStatus = ReviewStatus.PENDING;
    }

    public void review(ReviewStatus nextStatus, UUID reviewerId) {
        if (reviewStatus != ReviewStatus.PENDING) {
            throw new com.yunlan.platform.common.api.ApiException(
                    "DIAGNOSIS_ALREADY_REVIEWED",
                    org.springframework.http.HttpStatus.CONFLICT,
                    "Only pending diagnoses can be reviewed."
            );
        }
        if (!"VALID".equals(validationStatus)) {
            throw new com.yunlan.platform.common.api.ApiException(
                    "DIAGNOSIS_NOT_REVIEWABLE",
                    org.springframework.http.HttpStatus.UNPROCESSABLE_ENTITY,
                    "The diagnosis candidate did not pass validation."
            );
        }
        this.reviewStatus = nextStatus;
        this.reviewerId = reviewerId;
        this.reviewedAt = Instant.now();
    }

    public void replaceCandidate(String candidateJson) {
        if (reviewStatus != ReviewStatus.PENDING) {
            throw new com.yunlan.platform.common.api.ApiException(
                    "DIAGNOSIS_ALREADY_REVIEWED",
                    org.springframework.http.HttpStatus.CONFLICT,
                    "Only pending diagnoses can be modified."
            );
        }
        this.candidateJson = candidateJson;
    }

    public UUID getId() {
        return id;
    }

    public UUID getAttemptId() {
        return attemptId;
    }

    public String getCandidateJson() {
        return candidateJson;
    }

    public String getValidationStatus() {
        return validationStatus;
    }

    public ReviewStatus getReviewStatus() {
        return reviewStatus;
    }
}
