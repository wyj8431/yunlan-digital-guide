package com.yunlan.platform.ticket;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.Map;
import java.util.List;
import java.util.UUID;

public final class TicketDtos {
    private TicketDtos() {
    }

    public record CreateRequest(
            @NotNull UUID projectId,
            @NotBlank @Size(max = 200) String title,
            @NotBlank @Size(max = 10000) String description,
            UUID assigneeId
    ) {
    }

    public record ChangeStatusRequest(
            @NotNull TicketStatus status,
            @NotNull Long expectedVersion
    ) {
    }

    public record ChangeAssigneeRequest(
            UUID assigneeId,
            @NotNull Long expectedVersion
    ) {
    }

    public record CommentRequest(
            @NotBlank @Size(max = 10000) String body
    ) {
    }

    public record ProjectMemberResponse(
            UUID userId,
            String email,
            String role
    ) {
    }

    public record ProjectResponse(
            UUID id,
            String name
    ) {
        static ProjectResponse from(Project project) {
            return new ProjectResponse(project.getId(), project.getName());
        }
    }

    public record CommentResponse(
            UUID id,
            UUID ticketId,
            UUID authorId,
            String body,
            Instant createdAt
    ) {
        static CommentResponse from(TicketComment comment) {
            return new CommentResponse(
                    comment.getId(),
                    comment.getTicketId(),
                    comment.getAuthorId(),
                    comment.getBody(),
                    comment.getCreatedAt()
            );
        }
    }

    public record EventResponse(
            Long id,
            UUID ticketId,
            UUID actorId,
            TicketStatus fromStatus,
            TicketStatus toStatus,
            String idempotencyKey,
            Instant createdAt
    ) {
        static EventResponse from(TicketEvent event) {
            return new EventResponse(
                    event.getId(),
                    event.getTicketId(),
                    event.getActorId(),
                    event.getFromStatus(),
                    event.getToStatus(),
                    event.getIdempotencyKey(),
                    event.getCreatedAt()
            );
        }
    }

    public record AssignmentEventResponse(
            Long id,
            UUID ticketId,
            UUID actorId,
            UUID previousAssigneeId,
            UUID assigneeId,
            Instant createdAt
    ) {
        static AssignmentEventResponse from(TicketAssignmentEvent event) {
            return new AssignmentEventResponse(
                    event.getId(),
                    event.getTicketId(),
                    event.getActorId(),
                    event.getPreviousAssigneeId(),
                    event.getAssigneeId(),
                    event.getCreatedAt()
            );
        }
    }

    public record NotificationResponse(
            UUID id,
            UUID ticketId,
            String type,
            String message,
            Instant readAt,
            Instant createdAt
    ) {
        static NotificationResponse from(TicketNotification notification) {
            return new NotificationResponse(
                    notification.getId(),
                    notification.getTicketId(),
                    notification.getType(),
                    notification.getMessage(),
                    notification.getReadAt(),
                    notification.getCreatedAt()
            );
        }
    }

    public record NotificationListResponse(
            List<NotificationResponse> notifications,
            long unreadCount
    ) {
    }

    public record StatsResponse(
            long total,
            Map<TicketStatus, Long> byStatus
    ) {
    }

    public record TicketResponse(
            UUID id,
            UUID projectId,
            String title,
            String description,
            UUID reporterId,
            UUID assigneeId,
            TicketStatus status,
            long version,
            Instant createdAt,
            Instant updatedAt
    ) {
        static TicketResponse from(Ticket ticket) {
            return new TicketResponse(
                    ticket.getId(),
                    ticket.getProjectId(),
                    ticket.getTitle(),
                    ticket.getDescription(),
                    ticket.getReporterId(),
                    ticket.getAssigneeId(),
                    ticket.getStatus(),
                    ticket.getVersion(),
                    ticket.getCreatedAt(),
                    ticket.getUpdatedAt()
            );
        }
    }
}
