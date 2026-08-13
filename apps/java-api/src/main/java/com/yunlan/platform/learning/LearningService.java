package com.yunlan.platform.learning;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.yunlan.platform.common.api.ApiException;
import com.yunlan.platform.common.security.AuthPrincipal;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
public class LearningService {
    // WO-2: deterministic grading and staff-gated diagnosis publication boundary.
    private final QuestionRepository questions;
    private final AttemptRepository attempts;
    private final DiagnosisRepository diagnoses;
    private final DiagnosisProvider provider;
    private final DiagnosisValidator validator;
    private final ObjectMapper objectMapper;

    public LearningService(
            QuestionRepository questions,
            AttemptRepository attempts,
            DiagnosisRepository diagnoses,
            DiagnosisProvider provider,
            DiagnosisValidator validator,
            ObjectMapper objectMapper
    ) {
        this.questions = questions;
        this.attempts = attempts;
        this.diagnoses = diagnoses;
        this.provider = provider;
        this.validator = validator;
        this.objectMapper = objectMapper;
    }

    @Transactional(readOnly = true)
    public List<LearningDtos.QuestionResponse> listQuestions() {
        return questions.findAll().stream().map(LearningDtos.QuestionResponse::from).toList();
    }

    @Transactional
    public LearningDtos.AttemptResponse submit(LearningDtos.SubmitAttemptRequest request, AuthPrincipal learner) {
        var question = questions.findById(request.questionId()).orElseThrow(() -> new ApiException(
                "QUESTION_NOT_FOUND", HttpStatus.NOT_FOUND, "Question does not exist."
        ));
        var selectedAnswer = request.selectedAnswer().trim().toUpperCase();
        var attempt = attempts.save(new Attempt(
                question.getId(),
                learner.userId(),
                selectedAnswer,
                request.reasoning() == null ? null : request.reasoning().trim(),
                question.getCorrectAnswer().equalsIgnoreCase(selectedAnswer)
        ));
        if (!attempt.isCorrect()) {
            try {
                var candidate = provider.generate(question, attempt);
                validator.validate(candidate);
                diagnoses.save(new Diagnosis(attempt.getId(), serialize(candidate)));
            } catch (RuntimeException exception) {
                // Keep the deterministic grading result even when AI diagnosis is unavailable.
                diagnoses.save(new Diagnosis(attempt.getId(), "{}", "FAILED"));
            }
        }
        return toResponse(attempt, learner);
    }

    @Transactional(readOnly = true)
    public LearningDtos.AttemptResponse getAttempt(UUID id, AuthPrincipal principal) {
        var attempt = attempts.findById(id).orElseThrow(() -> new ApiException(
                "ATTEMPT_NOT_FOUND", HttpStatus.NOT_FOUND, "Attempt does not exist."
        ));
        if (!attempt.getLearnerId().equals(principal.userId()) && !isStaff(principal)) {
            throw new ApiException("FORBIDDEN", HttpStatus.FORBIDDEN, "You cannot view this attempt.");
        }
        return toResponse(attempt, principal);
    }

    @Transactional(readOnly = true)
    public List<LearningDtos.AttemptResponse> listPendingReviews(AuthPrincipal principal) {
        if (!isStaff(principal)) {
            throw new ApiException("FORBIDDEN", HttpStatus.FORBIDDEN, "Only teaching staff can view pending diagnoses.");
        }
        return attempts.findDiagnosedAttemptsByReviewStatus(ReviewStatus.PENDING).stream()
                .map(attempt -> toResponse(attempt, principal))
                .toList();
    }

    @Transactional
    public LearningDtos.AttemptResponse review(UUID attemptId, LearningDtos.ReviewRequest request, AuthPrincipal principal) {
        if (!isStaff(principal)) {
            throw new ApiException("FORBIDDEN", HttpStatus.FORBIDDEN, "Only teaching staff can review diagnoses.");
        }
        var attempt = attempts.findById(attemptId).orElseThrow(() -> new ApiException(
                "ATTEMPT_NOT_FOUND", HttpStatus.NOT_FOUND, "Attempt does not exist."
        ));
        if (attempt.isCorrect()) {
            throw new ApiException("NO_DIAGNOSIS", HttpStatus.UNPROCESSABLE_ENTITY, "Correct attempts do not have a diagnosis.");
        }
        if (request.status() == ReviewStatus.PENDING) {
            throw new ApiException(
                    "INVALID_REVIEW_STATUS",
                    HttpStatus.BAD_REQUEST,
                    "Review status must be CONFIRMED or REJECTED."
            );
        }
        var diagnosis = diagnoses.findByAttemptId(attemptId).orElseThrow(() -> new ApiException(
                "DIAGNOSIS_NOT_FOUND", HttpStatus.NOT_FOUND, "Diagnosis does not exist."
        ));
        if (request.candidateJson() != null && !request.candidateJson().isBlank()) {
            if (request.status() != ReviewStatus.CONFIRMED) {
                throw new ApiException(
                        "INVALID_REVIEW_REQUEST",
                        HttpStatus.BAD_REQUEST,
                        "A modified diagnosis must be confirmed."
                );
            }
            diagnosis.replaceCandidate(serialize(parseAndValidateCandidate(request.candidateJson())));
        }
        diagnosis.review(request.status(), principal.userId());
        return toResponse(attempt, principal);
    }

    private LearningDtos.AttemptResponse toResponse(Attempt attempt, AuthPrincipal principal) {
        var diagnosis = diagnoses.findByAttemptId(attempt.getId()).orElse(null);
        var canSeeCandidate = diagnosis != null && isStaff(principal);
        var isPublished = diagnosis != null
                && "VALID".equals(diagnosis.getValidationStatus())
                && diagnosis.getReviewStatus() == ReviewStatus.CONFIRMED;
        return new LearningDtos.AttemptResponse(
                attempt.getId(),
                attempt.getQuestionId(),
                attempt.getLearnerId(),
                attempt.isCorrect(),
                attempt.getSelectedAnswer(),
                attempt.getReasoning(),
                diagnosis == null ? null : diagnosis.getValidationStatus(),
                diagnosis == null ? null : diagnosis.getReviewStatus(),
                canSeeCandidate || isPublished ? diagnosis.getCandidateJson() : null,
                attempt.getCreatedAt()
        );
    }

    private String serialize(DiagnosisCandidate candidate) {
        try {
            return objectMapper.writeValueAsString(candidate);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Unable to serialize diagnosis", exception);
        }
    }

    private DiagnosisCandidate parseAndValidateCandidate(String candidateJson) {
        try {
            var root = objectMapper.readTree(candidateJson);
            validator.validateJsonShape(root);
            var candidate = objectMapper.treeToValue(root, DiagnosisCandidate.class);
            validator.validate(candidate);
            return candidate;
        } catch (JsonProcessingException exception) {
            throw new ApiException(
                    "INVALID_DIAGNOSIS",
                    HttpStatus.UNPROCESSABLE_ENTITY,
                    "Modified diagnosis must contain valid JSON."
            );
        }
    }

    private boolean isStaff(AuthPrincipal principal) {
        return "TEACHER".equals(principal.role()) || "ADMIN".equals(principal.role());
    }
}
