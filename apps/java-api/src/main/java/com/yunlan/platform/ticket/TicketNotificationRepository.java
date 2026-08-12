package com.yunlan.platform.ticket;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface TicketNotificationRepository extends JpaRepository<TicketNotification, UUID> {
    List<TicketNotification> findTop100ByRecipientIdOrderByCreatedAtDesc(UUID recipientId);

    long countByRecipientIdAndReadAtIsNull(UUID recipientId);

    Optional<TicketNotification> findByIdAndRecipientId(UUID id, UUID recipientId);
}
