package com.yunlan.platform.ticket;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "ticket_notifications")
public class TicketNotification {
    @Id
    private UUID id;

    @Column(name = "recipient_id", nullable = false)
    private UUID recipientId;

    @Column(name = "ticket_id")
    private UUID ticketId;

    @Column(name = "notification_type", nullable = false, length = 64)
    private String type;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String message;

    @Column(name = "read_at")
    private Instant readAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected TicketNotification() {
    }

    public TicketNotification(UUID recipientId, UUID ticketId, String type, String message) {
        this.id = UUID.randomUUID();
        this.recipientId = recipientId;
        this.ticketId = ticketId;
        this.type = type;
        this.message = message;
        this.createdAt = Instant.now();
    }

    public void markRead() {
        this.readAt = Instant.now();
    }

    public UUID getId() {
        return id;
    }

    public UUID getRecipientId() {
        return recipientId;
    }

    public UUID getTicketId() {
        return ticketId;
    }

    public String getType() {
        return type;
    }

    public String getMessage() {
        return message;
    }

    public Instant getReadAt() {
        return readAt;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
