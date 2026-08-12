package com.yunlan.platform.learning;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface DiagnosisRepository extends JpaRepository<Diagnosis, UUID> {
    Optional<Diagnosis> findByAttemptId(UUID attemptId);
}
