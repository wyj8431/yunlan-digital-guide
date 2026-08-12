package com.yunlan.platform.learning;

public interface DiagnosisProvider {
    DiagnosisCandidate generate(Question question, Attempt attempt);
}
