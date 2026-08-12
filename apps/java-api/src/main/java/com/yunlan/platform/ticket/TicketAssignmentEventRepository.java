package com.yunlan.platform.ticket;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface TicketAssignmentEventRepository extends JpaRepository<TicketAssignmentEvent, Long> {
    Optional<TicketAssignmentEvent> findByTicketIdAndIdempotencyKey(UUID ticketId, String idempotencyKey);

    List<TicketAssignmentEvent> findAllByTicketIdOrderByCreatedAtAsc(UUID ticketId);
}
