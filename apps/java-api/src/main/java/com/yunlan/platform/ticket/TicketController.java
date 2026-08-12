package com.yunlan.platform.ticket;

import com.yunlan.platform.common.security.CurrentUser;
import jakarta.validation.Valid;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;
import java.util.Map;

@RestController
@RequestMapping("/api/tickets")
public class TicketController {
    private final TicketService ticketService;

    public TicketController(TicketService ticketService) {
        this.ticketService = ticketService;
    }

    @GetMapping
    public Map<String, List<TicketDtos.TicketResponse>> list(
            @RequestParam(required = false) UUID projectId,
            Authentication authentication
    ) {
        return Map.of("tickets", ticketService.list(projectId, CurrentUser.require(authentication)));
    }

    @GetMapping("/projects")
    public Map<String, List<TicketDtos.ProjectResponse>> projects(Authentication authentication) {
        return Map.of("projects", ticketService.listProjects(CurrentUser.require(authentication)));
    }

    @GetMapping("/stats")
    public TicketDtos.StatsResponse stats(
            @RequestParam(required = false) UUID projectId,
            Authentication authentication
    ) {
        return ticketService.stats(projectId, CurrentUser.require(authentication));
    }

    @GetMapping("/members")
    public Map<String, List<TicketDtos.ProjectMemberResponse>> members(
            @RequestParam UUID projectId,
            Authentication authentication
    ) {
        return Map.of("members", ticketService.listProjectMembers(projectId, CurrentUser.require(authentication)));
    }

    @GetMapping("/notifications")
    public TicketDtos.NotificationListResponse notifications(Authentication authentication) {
        return ticketService.listNotifications(CurrentUser.require(authentication));
    }

    @PostMapping("/notifications/{id}/read")
    public TicketDtos.NotificationResponse markNotificationRead(
            @PathVariable UUID id,
            Authentication authentication
    ) {
        return ticketService.markNotificationRead(id, CurrentUser.require(authentication));
    }

    @GetMapping("/{id}")
    public TicketDtos.TicketResponse get(@PathVariable UUID id, Authentication authentication) {
        return ticketService.get(id, CurrentUser.require(authentication));
    }

    @GetMapping("/{id}/comments")
    public Map<String, List<TicketDtos.CommentResponse>> comments(
            @PathVariable UUID id,
            Authentication authentication
    ) {
        return Map.of("comments", ticketService.listComments(id, CurrentUser.require(authentication)));
    }

    @PostMapping("/{id}/comments")
    public TicketDtos.CommentResponse addComment(
            @PathVariable UUID id,
            @Valid @RequestBody TicketDtos.CommentRequest request,
            Authentication authentication
    ) {
        return ticketService.addComment(id, request, CurrentUser.require(authentication));
    }

    @GetMapping("/{id}/events")
    public Map<String, List<TicketDtos.EventResponse>> events(
            @PathVariable UUID id,
            Authentication authentication
    ) {
        return Map.of("events", ticketService.listEvents(id, CurrentUser.require(authentication)));
    }

    @GetMapping("/{id}/assignments")
    public Map<String, List<TicketDtos.AssignmentEventResponse>> assignments(
            @PathVariable UUID id,
            Authentication authentication
    ) {
        return Map.of("assignments", ticketService.listAssignmentEvents(id, CurrentUser.require(authentication)));
    }

    @PostMapping
    public TicketDtos.TicketResponse create(
            @Valid @RequestBody TicketDtos.CreateRequest request,
            Authentication authentication
    ) {
        return ticketService.create(request, CurrentUser.require(authentication));
    }

    @PostMapping("/{id}/status")
    public TicketDtos.TicketResponse changeStatus(
            @PathVariable UUID id,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
            @Valid @RequestBody TicketDtos.ChangeStatusRequest request,
            Authentication authentication
    ) {
        return ticketService.changeStatus(
                id,
                request,
                idempotencyKey,
                CurrentUser.require(authentication)
        );
    }

    @PostMapping("/{id}/assignee")
    public TicketDtos.TicketResponse changeAssignee(
            @PathVariable UUID id,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
            @Valid @RequestBody TicketDtos.ChangeAssigneeRequest request,
            Authentication authentication
    ) {
        return ticketService.changeAssignee(
                id,
                request,
                idempotencyKey,
                CurrentUser.require(authentication)
        );
    }
}
