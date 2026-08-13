package com.yunlan.platform.learning;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.yunlan.platform.common.security.AuthPrincipal;
import org.junit.jupiter.api.Test;

import java.util.Optional;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class LearningServiceTest {
    @Test
    void recordsCorrectAnswersWithoutCallingTheDiagnosisProvider() {
        var questions = mock(QuestionRepository.class);
        var attempts = mock(AttemptRepository.class);
        var diagnoses = mock(DiagnosisRepository.class);
        var provider = mock(DiagnosisProvider.class);
        var question = new Question(
                UUID.randomUUID(), "2x + 3 = 11", "{\"A\":\"3\",\"B\":\"4\"}", "B", "x = 4", "equation-one-variable", "easy"
        );
        var learner = new AuthPrincipal(UUID.randomUUID(), "learner@example.com", "LEARNER");
        when(questions.findById(question.getId())).thenReturn(Optional.of(question));
        when(attempts.save(any(Attempt.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(diagnoses.findByAttemptId(any(UUID.class))).thenReturn(Optional.empty());

        var service = new LearningService(
                questions, attempts, diagnoses, provider, new DiagnosisValidator(), new ObjectMapper()
        );
        var result = service.submit(new LearningDtos.SubmitAttemptRequest(question.getId(), "b", "Solved it."), learner);

        assertEquals(true, result.correct());
        assertNull(result.diagnosisJson());
        verify(provider, never()).generate(any(), any());
        verify(diagnoses, never()).save(any(Diagnosis.class));
    }

    @Test
    void rejectsLearnerAttemptsToReviewDiagnoses() {
        var service = new LearningService(
                mock(QuestionRepository.class), mock(AttemptRepository.class), mock(DiagnosisRepository.class),
                mock(DiagnosisProvider.class), new DiagnosisValidator(), new ObjectMapper()
        );
        var learner = new AuthPrincipal(UUID.randomUUID(), "learner@example.com", "LEARNER");

        var exception = org.junit.jupiter.api.Assertions.assertThrows(
                com.yunlan.platform.common.api.ApiException.class,
                () -> service.review(UUID.randomUUID(), new LearningDtos.ReviewRequest(ReviewStatus.CONFIRMED), learner)
        );

        assertEquals("FORBIDDEN", exception.code());
    }

    @Test
    void recordsIncorrectAttemptsWhenTheDiagnosisProviderTimesOutWithoutPublishingADiagnosis() {
        var questions = mock(QuestionRepository.class);
        var attempts = mock(AttemptRepository.class);
        var diagnoses = mock(DiagnosisRepository.class);
        var provider = mock(DiagnosisProvider.class);
        var failedDiagnosis = new AtomicReference<Diagnosis>();
        var question = new Question(
                UUID.randomUUID(), "2x + 3 = 11", "{\"A\":\"3\",\"B\":\"4\"}", "B", "x = 4", "equation-one-variable", "easy"
        );
        var learner = new AuthPrincipal(UUID.randomUUID(), "learner@example.com", "LEARNER");
        when(questions.findById(question.getId())).thenReturn(Optional.of(question));
        when(attempts.save(any(Attempt.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(provider.generate(any(Question.class), any(Attempt.class)))
                .thenThrow(new RuntimeException("model request timed out"));
        when(diagnoses.save(any(Diagnosis.class))).thenAnswer(invocation -> {
            Diagnosis diagnosis = invocation.getArgument(0);
            failedDiagnosis.set(diagnosis);
            return diagnosis;
        });
        when(diagnoses.findByAttemptId(any(UUID.class))).thenReturn(Optional.empty());

        var service = new LearningService(
                questions, attempts, diagnoses, provider, new DiagnosisValidator(), new ObjectMapper()
        );
        var result = service.submit(
                new LearningDtos.SubmitAttemptRequest(question.getId(), "A", "I divided first."), learner
        );

        assertEquals(false, result.correct());
        assertNull(result.diagnosisJson());
        verify(diagnoses).save(any(Diagnosis.class));
        assertEquals("FAILED", failedDiagnosis.get().getValidationStatus());
        assertEquals(ReviewStatus.PENDING, failedDiagnosis.get().getReviewStatus());
    }

    @Test
    void rejectsUnknownModelKnowledgePointsWhileKeepingTheDeterministicAttemptResult() {
        var questions = mock(QuestionRepository.class);
        var attempts = mock(AttemptRepository.class);
        var diagnoses = mock(DiagnosisRepository.class);
        var provider = mock(DiagnosisProvider.class);
        var failedDiagnosis = new AtomicReference<Diagnosis>();
        var question = new Question(
                UUID.randomUUID(), "2x + 3 = 11", "{\"A\":\"3\",\"B\":\"4\"}", "B", "x = 4", "equation-one-variable", "easy"
        );
        var unknownKnowledgePoint = new DiagnosisCandidate(
                "outside-the-controlled-catalog",
                "ARITHMETIC_ERROR",
                "The final arithmetic step is inconsistent.",
                java.util.stream.IntStream.rangeClosed(1, 7)
                        .mapToObj(day -> new DiagnosisCandidate.PlanDay(day, "Practice", "resource-equation-basics"))
                        .toList()
        );
        var learner = new AuthPrincipal(UUID.randomUUID(), "learner@example.com", "LEARNER");
        when(questions.findById(question.getId())).thenReturn(Optional.of(question));
        when(attempts.save(any(Attempt.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(provider.generate(any(Question.class), any(Attempt.class))).thenReturn(unknownKnowledgePoint);
        when(diagnoses.save(any(Diagnosis.class))).thenAnswer(invocation -> {
            Diagnosis diagnosis = invocation.getArgument(0);
            failedDiagnosis.set(diagnosis);
            return diagnosis;
        });
        when(diagnoses.findByAttemptId(any(UUID.class))).thenReturn(Optional.empty());

        var service = new LearningService(
                questions, attempts, diagnoses, provider, new DiagnosisValidator(), new ObjectMapper()
        );
        var result = service.submit(
                new LearningDtos.SubmitAttemptRequest(question.getId(), "A", "I divided first."), learner
        );

        assertEquals(false, result.correct());
        assertNull(result.diagnosisJson());
        assertEquals("FAILED", failedDiagnosis.get().getValidationStatus());
        assertEquals(ReviewStatus.PENDING, failedDiagnosis.get().getReviewStatus());
    }

    @Test
    void keepsPendingDiagnosisHiddenFromLearnersUntilTeacherConfirmation() throws Exception {
        var questions = mock(QuestionRepository.class);
        var attempts = mock(AttemptRepository.class);
        var diagnoses = mock(DiagnosisRepository.class);
        var provider = mock(DiagnosisProvider.class);
        var validator = mock(DiagnosisValidator.class);
        var savedAttempt = new AtomicReference<Attempt>();
        var savedDiagnosis = new AtomicReference<Diagnosis>();
        var question = new Question(
                UUID.randomUUID(),
                "2x + 3 = 11",
                "{\"A\":\"3\",\"B\":\"4\"}",
                "B",
                "x = 4",
                "equation-one-variable",
                "easy"
        );
        var candidate = new DiagnosisCandidate(
                "equation-one-variable",
                "ARITHMETIC_ERROR",
                "The final arithmetic step is inconsistent.",
                java.util.stream.IntStream.rangeClosed(1, 7)
                        .mapToObj(day -> new DiagnosisCandidate.PlanDay(day, "Practice", "resource-equation-basics"))
                        .toList()
        );
        var learner = new AuthPrincipal(UUID.randomUUID(), "learner@example.com", "LEARNER");
        var teacher = new AuthPrincipal(UUID.randomUUID(), "teacher@example.com", "TEACHER");

        when(questions.findById(question.getId())).thenReturn(Optional.of(question));
        when(attempts.save(any(Attempt.class))).thenAnswer(invocation -> {
            Attempt attempt = invocation.getArgument(0);
            savedAttempt.set(attempt);
            return attempt;
        });
        when(attempts.findById(any(UUID.class))).thenAnswer(invocation -> Optional.ofNullable(savedAttempt.get()));
        when(attempts.findDiagnosedAttemptsByReviewStatus(ReviewStatus.PENDING))
                .thenAnswer(invocation -> savedAttempt.get() == null ? List.of() : List.of(savedAttempt.get()));
        when(provider.generate(any(Question.class), any(Attempt.class))).thenReturn(candidate);
        when(diagnoses.save(any(Diagnosis.class))).thenAnswer(invocation -> {
            Diagnosis diagnosis = invocation.getArgument(0);
            savedDiagnosis.set(diagnosis);
            return diagnosis;
        });
        when(diagnoses.findByAttemptId(any(UUID.class))).thenAnswer(invocation -> Optional.ofNullable(savedDiagnosis.get()));

        var service = new LearningService(
                questions,
                attempts,
                diagnoses,
                provider,
                validator,
                new ObjectMapper()
        );
        var submitted = service.submit(
                new LearningDtos.SubmitAttemptRequest(question.getId(), "A", "I divided first."),
                learner
        );

        assertEquals(ReviewStatus.PENDING, submitted.reviewStatus());
        assertNull(submitted.diagnosisJson());

        var pending = service.listPendingReviews(teacher);
        assertEquals(1, pending.size());
        assertEquals(submitted.id(), pending.getFirst().id());
        assertNotNull(pending.getFirst().diagnosisJson());

        var attemptId = submitted.id();
        var editedCandidate = new DiagnosisCandidate(
                "equation-one-variable",
                "ARITHMETIC_ERROR",
                "The teacher confirmed that division by two was skipped.",
                java.util.stream.IntStream.rangeClosed(1, 7)
                        .mapToObj(day -> new DiagnosisCandidate.PlanDay(day, "Practice", "resource-equation-basics"))
                        .toList()
        );
        var reviewed = service.review(
                attemptId,
                new LearningDtos.ReviewRequest(ReviewStatus.CONFIRMED, new ObjectMapper().writeValueAsString(editedCandidate)),
                teacher
        );
        assertNotNull(reviewed.diagnosisJson());
        org.junit.jupiter.api.Assertions.assertTrue(reviewed.diagnosisJson().contains("teacher confirmed"));

        var published = service.getAttempt(attemptId, learner);
        assertNotNull(published.diagnosisJson());
    }

    @Test
    void keepsRejectedDiagnosisHiddenFromLearnersWhileReturningItsReviewStatus() {
        var questions = mock(QuestionRepository.class);
        var attempts = mock(AttemptRepository.class);
        var diagnoses = mock(DiagnosisRepository.class);
        var provider = mock(DiagnosisProvider.class);
        var savedAttempt = new AtomicReference<Attempt>();
        var savedDiagnosis = new AtomicReference<Diagnosis>();
        var question = new Question(
                UUID.randomUUID(),
                "2x + 3 = 11",
                "{\"A\":\"3\",\"B\":\"4\"}",
                "B",
                "x = 4",
                "equation-one-variable",
                "easy"
        );
        var candidate = new DiagnosisCandidate(
                "equation-one-variable",
                "ARITHMETIC_ERROR",
                "The final arithmetic step is inconsistent.",
                java.util.stream.IntStream.rangeClosed(1, 7)
                        .mapToObj(day -> new DiagnosisCandidate.PlanDay(day, "Practice", "resource-equation-basics"))
                        .toList()
        );
        var learner = new AuthPrincipal(UUID.randomUUID(), "learner@example.com", "LEARNER");
        var teacher = new AuthPrincipal(UUID.randomUUID(), "teacher@example.com", "TEACHER");
        when(questions.findById(question.getId())).thenReturn(Optional.of(question));
        when(attempts.save(any(Attempt.class))).thenAnswer(invocation -> {
            Attempt attempt = invocation.getArgument(0);
            savedAttempt.set(attempt);
            return attempt;
        });
        when(attempts.findById(any(UUID.class))).thenAnswer(invocation -> Optional.ofNullable(savedAttempt.get()));
        when(provider.generate(any(Question.class), any(Attempt.class))).thenReturn(candidate);
        when(diagnoses.save(any(Diagnosis.class))).thenAnswer(invocation -> {
            Diagnosis diagnosis = invocation.getArgument(0);
            savedDiagnosis.set(diagnosis);
            return diagnosis;
        });
        when(diagnoses.findByAttemptId(any(UUID.class))).thenAnswer(invocation -> Optional.ofNullable(savedDiagnosis.get()));

        var service = new LearningService(
                questions, attempts, diagnoses, provider, new DiagnosisValidator(), new ObjectMapper()
        );
        var submitted = service.submit(
                new LearningDtos.SubmitAttemptRequest(question.getId(), "A", "I divided first."), learner
        );

        var rejected = service.review(
                submitted.id(), new LearningDtos.ReviewRequest(ReviewStatus.REJECTED), teacher
        );
        var learnerView = service.getAttempt(submitted.id(), learner);

        assertEquals(ReviewStatus.REJECTED, rejected.reviewStatus());
        assertEquals(ReviewStatus.REJECTED, learnerView.reviewStatus());
        assertNull(learnerView.diagnosisJson());
    }
}
