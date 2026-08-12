package com.yunlan.platform.learning;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface AttemptRepository extends JpaRepository<Attempt, UUID> {
    Optional<Attempt> findByIdAndLearnerId(UUID id, UUID learnerId);

    @Query("""
            select attempt
            from Attempt attempt
            where exists (
                select 1
                from Diagnosis diagnosis
                where diagnosis.attemptId = attempt.id
                  and diagnosis.validationStatus = 'VALID'
                  and diagnosis.reviewStatus = :reviewStatus
            )
            order by attempt.createdAt asc
            """)
    List<Attempt> findDiagnosedAttemptsByReviewStatus(@Param("reviewStatus") ReviewStatus reviewStatus);
}
