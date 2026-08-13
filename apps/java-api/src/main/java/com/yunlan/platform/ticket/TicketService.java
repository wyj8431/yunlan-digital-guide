package com.yunlan.platform.ticket;

import com.yunlan.platform.auth.UserAccount;
import com.yunlan.platform.auth.UserAccountRepository;
import com.yunlan.platform.common.api.ApiException;
import com.yunlan.platform.common.security.AuthPrincipal;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.EnumMap;
import java.util.Map;
import java.util.UUID;
import java.util.Comparator;
import java.util.Locale;
import java.util.Objects;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class TicketService {
    // WO-1: membership, version, idempotency, audit, and notification rules live here.
    private final TicketRepository tickets;
    private final TicketEventRepository events;
    private final TicketAssignmentEventRepository assignmentEvents;
    private final ProjectRepository projects;
    private final ProjectMemberRepository members;
    private final UserAccountRepository users;
    private final TicketCommentRepository comments;
    private final TicketNotificationRepository notifications;
    private final TicketCreationRequestRepository creationRequests;

    public TicketService(
            TicketRepository tickets,
            TicketEventRepository events,
            TicketAssignmentEventRepository assignmentEvents,
            ProjectRepository projects,
            ProjectMemberRepository members,
            UserAccountRepository users,
            TicketCommentRepository comments,
            TicketNotificationRepository notifications,
            TicketCreationRequestRepository creationRequests
    ) {
        this.tickets = tickets;
        this.events = events;
        this.assignmentEvents = assignmentEvents;
        this.projects = projects;
        this.members = members;
        this.users = users;
        this.comments = comments;
        this.notifications = notifications;
        this.creationRequests = creationRequests;
    }

    @Transactional(readOnly = true)
    public List<TicketDtos.TicketResponse> list(UUID projectId, AuthPrincipal principal) {
        var projectIds = accessibleProjectIds(projectId, principal);
        return tickets.findAllByProjectIdInOrderByUpdatedAtDesc(projectIds).stream()
                .map(TicketDtos.TicketResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<TicketDtos.ProjectResponse> listProjects(AuthPrincipal principal) {
        var projectIds = accessibleProjectIds(null, principal);
        return projects.findAllById(projectIds).stream()
                .sorted(Comparator.comparing(Project::getName, String.CASE_INSENSITIVE_ORDER))
                .map(TicketDtos.ProjectResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public TicketDtos.TicketResponse get(UUID id, AuthPrincipal principal) {
        var ticket = findTicket(id);
        requireAccess(ticket.getProjectId(), principal);
        return TicketDtos.TicketResponse.from(ticket);
    }

    @Transactional
    public TicketDtos.TicketResponse create(
            TicketDtos.CreateRequest request,
            String idempotencyKey,
            AuthPrincipal principal
    ) {
        requireIdempotencyKey(idempotencyKey);
        requireProject(request.projectId());
        requireAccess(request.projectId(), principal);
        if (request.assigneeId() != null && !members.existsByProjectIdAndUserId(request.projectId(), request.assigneeId())) {
            throw new ApiException("INVALID_ASSIGNEE", HttpStatus.BAD_REQUEST, "Assignee is not a member of the project.");
        }
        var title = request.title().trim();
        var description = request.description().trim();
        var fingerprint = createRequestFingerprint(request.projectId(), title, description, request.assigneeId());

        // Serializing creates per actor turns the unique key into a replay record rather than a race.
        users.findByIdForUpdate(principal.userId()).orElseThrow(() -> new ApiException(
                "UNAUTHORIZED", HttpStatus.UNAUTHORIZED, "Authenticated user does not exist."
        ));
        var previousRequest = creationRequests.findByActorIdAndIdempotencyKey(principal.userId(), idempotencyKey);
        if (previousRequest.isPresent()) {
            if (!previousRequest.get().getRequestFingerprint().equals(fingerprint)) {
                throw new ApiException(
                        "IDEMPOTENCY_KEY_REUSED",
                        HttpStatus.CONFLICT,
                        "Idempotency-Key was already used for a different ticket creation."
                );
            }
            return TicketDtos.TicketResponse.from(findTicket(previousRequest.get().getTicketId()));
        }
        var ticket = tickets.save(new Ticket(
                request.projectId(),
                title,
                description,
                principal.userId(),
                request.assigneeId()
        ));
        creationRequests.save(new TicketCreationRequest(principal.userId(), idempotencyKey, fingerprint, ticket.getId()));
        if (request.assigneeId() != null && !request.assigneeId().equals(principal.userId())) {
            notifications.save(new TicketNotification(
                    request.assigneeId(),
                    ticket.getId(),
                    "TICKET_ASSIGNED",
                    "You were assigned ticket: " + ticket.getTitle()
            ));
        }
        return TicketDtos.TicketResponse.from(ticket);
    }

    @Transactional
    public TicketDtos.TicketResponse changeStatus(
            UUID id,
            TicketDtos.ChangeStatusRequest request,
            String idempotencyKey,
            AuthPrincipal principal
    ) {
        if (idempotencyKey == null || idempotencyKey.isBlank() || idempotencyKey.length() > 120) {
            throw new ApiException("IDEMPOTENCY_KEY_REQUIRED", HttpStatus.BAD_REQUEST, "Idempotency-Key is required.");
        }
        var ticket = findTicketForUpdate(id);
        requireAccess(ticket.getProjectId(), principal);
        var previousEvent = events.findByTicketIdAndIdempotencyKey(id, idempotencyKey);
        if (previousEvent.isPresent()) {
            if (previousEvent.get().getToStatus() != request.status()) {
                throw new ApiException(
                        "IDEMPOTENCY_KEY_REUSED",
                        HttpStatus.CONFLICT,
                        "Idempotency-Key was already used for a different status change."
                );
            }
            return TicketDtos.TicketResponse.from(ticket);
        }
        if (ticket.getVersion() != request.expectedVersion()) {
            throw new ApiException("VERSION_CONFLICT", HttpStatus.CONFLICT, "Ticket has changed. Reload and retry.");
        }
        var previousStatus = ticket.getStatus();
        try {
            ticket.changeStatus(request.status());
        } catch (IllegalStateException exception) {
            throw new ApiException("INVALID_STATUS_TRANSITION", HttpStatus.UNPROCESSABLE_ENTITY, exception.getMessage());
        }
        tickets.saveAndFlush(ticket);
        events.save(new TicketEvent(id, principal.userId(), previousStatus, request.status(), idempotencyKey));
        notifyParticipants(
                ticket,
                principal.userId(),
                "TICKET_STATUS_CHANGED",
                "Ticket " + ticket.getTitle() + " moved to " + request.status() + "."
        );
        return TicketDtos.TicketResponse.from(ticket);
    }

    @Transactional
    public TicketDtos.TicketResponse changeAssignee(
            UUID id,
            TicketDtos.ChangeAssigneeRequest request,
            String idempotencyKey,
            AuthPrincipal principal
    ) {
        requireIdempotencyKey(idempotencyKey);
        var ticket = accessibleTicketForUpdate(id, principal);
        requireAssignmentPermission(ticket, principal);
        if (request.assigneeId() != null && !members.existsByProjectIdAndUserId(ticket.getProjectId(), request.assigneeId())) {
            throw new ApiException("INVALID_ASSIGNEE", HttpStatus.BAD_REQUEST, "Assignee is not a member of the project.");
        }
        var previousEvent = assignmentEvents.findByTicketIdAndIdempotencyKey(id, idempotencyKey);
        if (previousEvent.isPresent()) {
            if (!Objects.equals(previousEvent.get().getAssigneeId(), request.assigneeId())) {
                throw new ApiException(
                        "IDEMPOTENCY_KEY_REUSED",
                        HttpStatus.CONFLICT,
                        "Idempotency-Key was already used for a different assignee change."
                );
            }
            return TicketDtos.TicketResponse.from(ticket);
        }
        if (ticket.getVersion() != request.expectedVersion()) {
            throw new ApiException("VERSION_CONFLICT", HttpStatus.CONFLICT, "Ticket has changed. Reload and retry.");
        }
        var previousAssigneeId = ticket.getAssigneeId();
        if (Objects.equals(previousAssigneeId, request.assigneeId())) {
            return TicketDtos.TicketResponse.from(ticket);
        }
        ticket.changeAssignee(request.assigneeId());
        tickets.saveAndFlush(ticket);
        assignmentEvents.save(new TicketAssignmentEvent(
                ticket.getId(),
                principal.userId(),
                previousAssigneeId,
                request.assigneeId(),
                idempotencyKey
        ));
        notifyAssignmentParticipants(ticket, previousAssigneeId, principal.userId());
        return TicketDtos.TicketResponse.from(ticket);
    }

    @Transactional(readOnly = true)
    public List<TicketDtos.CommentResponse> listComments(UUID id, AuthPrincipal principal) {
        var ticket = accessibleTicket(id, principal);
        return comments.findAllByTicketIdOrderByCreatedAtAsc(ticket.getId()).stream()
                .map(TicketDtos.CommentResponse::from)
                .toList();
    }

    @Transactional
    public TicketDtos.CommentResponse addComment(
            UUID id,
            TicketDtos.CommentRequest request,
            AuthPrincipal principal
    ) {
        var ticket = accessibleTicket(id, principal);
        var comment = comments.save(new TicketComment(ticket.getId(), principal.userId(), request.body().trim()));
        notifyParticipants(
                ticket,
                principal.userId(),
                "TICKET_COMMENT_ADDED",
                "New comment on ticket: " + ticket.getTitle()
        );
        return TicketDtos.CommentResponse.from(comment);
    }

    @Transactional(readOnly = true)
    public List<TicketDtos.EventResponse> listEvents(UUID id, AuthPrincipal principal) {
        var ticket = accessibleTicket(id, principal);
        return events.findAllByTicketIdOrderByCreatedAtAsc(ticket.getId()).stream()
                .map(TicketDtos.EventResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<TicketDtos.AssignmentEventResponse> listAssignmentEvents(UUID id, AuthPrincipal principal) {
        var ticket = accessibleTicket(id, principal);
        return assignmentEvents.findAllByTicketIdOrderByCreatedAtAsc(ticket.getId()).stream()
                .map(TicketDtos.AssignmentEventResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public TicketDtos.NotificationListResponse listNotifications(AuthPrincipal principal) {
        var items = notifications.findTop100ByRecipientIdOrderByCreatedAtDesc(principal.userId()).stream()
                .map(TicketDtos.NotificationResponse::from)
                .toList();
        return new TicketDtos.NotificationListResponse(
                items,
                notifications.countByRecipientIdAndReadAtIsNull(principal.userId())
        );
    }

    @Transactional
    public TicketDtos.NotificationResponse markNotificationRead(UUID notificationId, AuthPrincipal principal) {
        var notification = notifications.findByIdAndRecipientId(notificationId, principal.userId())
                .orElseThrow(() -> new ApiException(
                        "NOTIFICATION_NOT_FOUND",
                        HttpStatus.NOT_FOUND,
                        "Notification does not exist."
                ));
        notification.markRead();
        return TicketDtos.NotificationResponse.from(notification);
    }

    @Transactional(readOnly = true)
    public TicketDtos.StatsResponse stats(UUID projectId, AuthPrincipal principal) {
        var projectIds = accessibleProjectIds(projectId, principal);
        var counts = new EnumMap<TicketStatus, Long>(TicketStatus.class);
        for (var status : TicketStatus.values()) {
            counts.put(status, 0L);
        }
        var visibleTickets = projectIds.isEmpty()
                ? List.<Ticket>of()
                : tickets.findAllByProjectIdInOrderByUpdatedAtDesc(projectIds);
        visibleTickets.forEach(ticket -> counts.compute(ticket.getStatus(), (key, value) -> value + 1));
        return new TicketDtos.StatsResponse(visibleTickets.size(), Map.copyOf(counts));
    }

    @Transactional(readOnly = true)
    public List<TicketDtos.ProjectMemberResponse> listProjectMembers(UUID projectId, AuthPrincipal principal) {
        requireProject(projectId);
        requireAccess(projectId, principal);
        var projectMembers = members.findAllByProjectId(projectId);
        Map<UUID, UserAccount> usersById = users.findAllById(projectMembers.stream()
                        .map(ProjectMember::getUserId)
                        .toList())
                .stream()
                .collect(Collectors.toMap(
                        UserAccount::getId,
                        Function.identity()
                ));
        return projectMembers.stream()
                .map(ProjectMember::getUserId)
                .map(usersById::get)
                .filter(Objects::nonNull)
                .sorted(Comparator.comparing(user -> user.getEmail().toLowerCase(Locale.ROOT)))
                .map(user -> new TicketDtos.ProjectMemberResponse(
                        user.getId(),
                        user.getEmail(),
                        user.getRole()
                ))
                .toList();
    }

    private Ticket accessibleTicket(UUID id, AuthPrincipal principal) {
        var ticket = findTicket(id);
        requireAccess(ticket.getProjectId(), principal);
        return ticket;
    }

    private Ticket accessibleTicketForUpdate(UUID id, AuthPrincipal principal) {
        var ticket = findTicketForUpdate(id);
        requireAccess(ticket.getProjectId(), principal);
        return ticket;
    }

    private void notifyParticipants(Ticket ticket, UUID actorId, String type, String message) {
        var recipients = new java.util.HashSet<UUID>();
        recipients.add(ticket.getReporterId());
        if (ticket.getAssigneeId() != null) {
            recipients.add(ticket.getAssigneeId());
        }
        recipients.remove(actorId);
        recipients.forEach(recipient -> notifications.save(new TicketNotification(
                recipient,
                ticket.getId(),
                type,
                message
        )));
    }

    private Ticket findTicket(UUID id) {
        return tickets.findById(id).orElseThrow(() -> new ApiException(
                "TICKET_NOT_FOUND", HttpStatus.NOT_FOUND, "Ticket does not exist."
        ));
    }

    private Ticket findTicketForUpdate(UUID id) {
        return tickets.findByIdForUpdate(id).orElseThrow(() -> new ApiException(
                "TICKET_NOT_FOUND", HttpStatus.NOT_FOUND, "Ticket does not exist."
        ));
    }

    private void notifyAssignmentParticipants(Ticket ticket, UUID previousAssigneeId, UUID actorId) {
        if (previousAssigneeId != null && !previousAssigneeId.equals(actorId)) {
            notifications.save(new TicketNotification(
                    previousAssigneeId,
                    ticket.getId(),
                    "TICKET_UNASSIGNED",
                    "You were unassigned from ticket: " + ticket.getTitle()
            ));
        }
        if (ticket.getAssigneeId() != null && !ticket.getAssigneeId().equals(actorId)) {
            notifications.save(new TicketNotification(
                    ticket.getAssigneeId(),
                    ticket.getId(),
                    "TICKET_ASSIGNED",
                    "You were assigned ticket: " + ticket.getTitle()
            ));
        }
        if (!ticket.getReporterId().equals(actorId)
                && !ticket.getReporterId().equals(previousAssigneeId)
                && !ticket.getReporterId().equals(ticket.getAssigneeId())) {
            notifications.save(new TicketNotification(
                    ticket.getReporterId(),
                    ticket.getId(),
                    "TICKET_ASSIGNEE_CHANGED",
                    "Ticket assignment changed: " + ticket.getTitle()
            ));
        }
    }

    private void requireProject(UUID projectId) {
        if (!projects.existsById(projectId)) {
            throw new ApiException("PROJECT_NOT_FOUND", HttpStatus.NOT_FOUND, "Project does not exist.");
        }
    }

    private void requireAccess(UUID projectId, AuthPrincipal principal) {
        if (!isAdmin(principal) && !members.existsByProjectIdAndUserId(projectId, principal.userId())) {
            throw new ApiException("FORBIDDEN", HttpStatus.FORBIDDEN, "You are not a member of this project.");
        }
    }

    private boolean isAdmin(AuthPrincipal principal) {
        return "ADMIN".equals(principal.role());
    }

    private void requireIdempotencyKey(String idempotencyKey) {
        if (idempotencyKey == null || idempotencyKey.isBlank() || idempotencyKey.length() > 120) {
            throw new ApiException("IDEMPOTENCY_KEY_REQUIRED", HttpStatus.BAD_REQUEST, "Idempotency-Key is required.");
        }
    }

    private String createRequestFingerprint(UUID projectId, String title, String description, UUID assigneeId) {
        var canonical = "%s|%d:%s|%d:%s|%s".formatted(
                projectId,
                title.length(), title,
                description.length(), description,
                assigneeId == null ? "" : assigneeId
        );
        try {
            var digest = MessageDigest.getInstance("SHA-256");
            return java.util.HexFormat.of().formatHex(digest.digest(canonical.getBytes(StandardCharsets.UTF_8)));
        } catch (java.security.NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is unavailable.", exception);
        }
    }

    private void requireAssignmentPermission(Ticket ticket, AuthPrincipal principal) {
        if (!isAdmin(principal) && !ticket.getReporterId().equals(principal.userId())) {
            throw new ApiException("FORBIDDEN", HttpStatus.FORBIDDEN, "Only the reporter or an administrator can change the assignee.");
        }
    }

    private List<UUID> accessibleProjectIds(UUID projectId, AuthPrincipal principal) {
        if (projectId != null) {
            requireProject(projectId);
            requireAccess(projectId, principal);
            return List.of(projectId);
        }
        return isAdmin(principal)
                ? projects.findAll().stream().map(Project::getId).toList()
                : members.findProjectIdsByUserId(principal.userId());
    }
}
