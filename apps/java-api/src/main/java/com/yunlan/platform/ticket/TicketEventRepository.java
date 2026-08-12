package com.yunlan.platform.ticket;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.List;
import java.util.UUID;

public interface TicketEventRepository extends JpaRepository<TicketEvent, Long> {
    Optional<TicketEvent> findByTicketIdAndIdempotencyKey(UUID ticketId, String idempotencyKey);

    List<TicketEvent> findAllByTicketIdOrderByCreatedAtAsc(UUID ticketId);
}
