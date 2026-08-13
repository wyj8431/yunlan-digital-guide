package com.yunlan.platform.ticket;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "ticket_creation_requests")
public class TicketCreationRequest {
    @Id
    private UUID id;

    @Column(name = "actor_id", nullable = false)
    private UUID actorId;

    @Column(name = "idempotency_key", nullable = false, length = 120)
    private String idempotencyKey;

    @Column(name = "request_fingerprint", nullable = false, length = 64)
    private String requestFingerprint;

    @Column(name = "ticket_id", nullable = false, unique = true)
    private UUID ticketId;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected TicketCreationRequest() {
    }

    public TicketCreationRequest(UUID actorId, String idempotencyKey, String requestFingerprint, UUID ticketId) {
        this.id = UUID.randomUUID();
        this.actorId = actorId;
        this.idempotencyKey = idempotencyKey;
        this.requestFingerprint = requestFingerprint;
        this.ticketId = ticketId;
        this.createdAt = Instant.now();
    }

    public String getRequestFingerprint() {
        return requestFingerprint;
    }

    public UUID getTicketId() {
        return ticketId;
    }
}
