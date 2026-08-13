package com.yunlan.platform.ticket;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface TicketCreationRequestRepository extends JpaRepository<TicketCreationRequest, UUID> {
    Optional<TicketCreationRequest> findByActorIdAndIdempotencyKey(UUID actorId, String idempotencyKey);
}
