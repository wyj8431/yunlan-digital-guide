package com.yunlan.platform.ticket;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "tickets")
public class Ticket {
    @Id
    private UUID id;

    @Column(name = "project_id", nullable = false)
    private UUID projectId;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String description;

    @Column(name = "reporter_id", nullable = false)
    private UUID reporterId;

    @Column(name = "assignee_id")
    private UUID assigneeId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private TicketStatus status;

    @Version
    @Column(nullable = false)
    private long version;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected Ticket() {
    }

    public Ticket(UUID projectId, String title, String description, UUID reporterId, UUID assigneeId) {
        this.id = UUID.randomUUID();
        this.projectId = projectId;
        this.title = title;
        this.description = description;
        this.reporterId = reporterId;
        this.assigneeId = assigneeId;
        this.status = TicketStatus.OPEN;
        this.version = 0;
        this.createdAt = Instant.now();
        this.updatedAt = this.createdAt;
    }

    public void changeStatus(TicketStatus nextStatus) {
        if (!isAllowedTransition(status, nextStatus)) {
            throw new IllegalStateException("Invalid ticket status transition: " + status + " -> " + nextStatus);
        }
        this.status = nextStatus;
        this.updatedAt = Instant.now();
    }

    public void changeAssignee(UUID nextAssigneeId) {
        this.assigneeId = nextAssigneeId;
        this.updatedAt = Instant.now();
    }

    private boolean isAllowedTransition(TicketStatus from, TicketStatus to) {
        return switch (from) {
            case OPEN -> to == TicketStatus.IN_PROGRESS;
            case IN_PROGRESS -> to == TicketStatus.RESOLVED;
            case RESOLVED -> to == TicketStatus.CLOSED || to == TicketStatus.IN_PROGRESS;
            case CLOSED -> false;
        };
    }

    public UUID getId() {
        return id;
    }

    public UUID getProjectId() {
        return projectId;
    }

    public String getTitle() {
        return title;
    }

    public String getDescription() {
        return description;
    }

    public UUID getReporterId() {
        return reporterId;
    }

    public UUID getAssigneeId() {
        return assigneeId;
    }

    public TicketStatus getStatus() {
        return status;
    }

    public long getVersion() {
        return version;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
