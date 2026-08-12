package com.yunlan.platform.ticket;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "ticket_assignment_events")
public class TicketAssignmentEvent {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "ticket_id", nullable = false)
    private UUID ticketId;

    @Column(name = "actor_id", nullable = false)
    private UUID actorId;

    @Column(name = "previous_assignee_id")
    private UUID previousAssigneeId;

    @Column(name = "assignee_id")
    private UUID assigneeId;

    @Column(name = "idempotency_key", nullable = false, length = 120)
    private String idempotencyKey;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected TicketAssignmentEvent() {
    }

    public TicketAssignmentEvent(
            UUID ticketId,
            UUID actorId,
            UUID previousAssigneeId,
            UUID assigneeId,
            String idempotencyKey
    ) {
        this.ticketId = ticketId;
        this.actorId = actorId;
        this.previousAssigneeId = previousAssigneeId;
        this.assigneeId = assigneeId;
        this.idempotencyKey = idempotencyKey;
        this.createdAt = Instant.now();
    }

    public Long getId() {
        return id;
    }

    public UUID getTicketId() {
        return ticketId;
    }

    public UUID getActorId() {
        return actorId;
    }

    public UUID getPreviousAssigneeId() {
        return previousAssigneeId;
    }

    public UUID getAssigneeId() {
        return assigneeId;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
