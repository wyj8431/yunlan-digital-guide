package com.yunlan.platform.learning;

import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import java.util.stream.IntStream;

@Component
@Profile("!real-learning-model")
public class MockDiagnosisProvider implements DiagnosisProvider {
    @Override
    public DiagnosisCandidate generate(Question question, Attempt attempt) {
        var plan = IntStream.rangeClosed(1, 7)
                .mapToObj(day -> new DiagnosisCandidate.PlanDay(
                        day,
                        "Review the equation-solving step and complete one similar exercise.",
                        "resource-equation-basics"
                ))
                .toList();
        return new DiagnosisCandidate(
                question.getKnowledgePointId(),
                "SIGN_OR_TRANSPOSE_ERROR",
                "The selected answer differs from the canonical solution; compare the learner reasoning with the rearrangement step.",
                plan
        );
    }
}
